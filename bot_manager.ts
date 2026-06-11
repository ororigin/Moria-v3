import { spawn, exec, execFile, fork, ChildProcess } from 'child_process';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { C2MProcessTransportData, M2CProcessTransportData, InternalData } from './type/transport.js';
import { isM2CProcessTransportData, isC2MProcessTransportData, isInternalData } from './type/transport.js';
import type { ConfigManagerFactory } from './storage/config/factory/ConfigManagerFactory.js';
import { ConfigType } from './storage/config/factory/ConfigType.js';
import type { BotConfig } from './storage/config/types/BotConfig.js';
import { promisify } from 'util';
import os from 'os';

const execPromise = promisify(exec);

//子进程列表数据结构
interface BotProcessList {
    [bot_id: string]: ChildProcess;
}

//子进程pid列表数据结构
interface BotProcessPidList {
    [bot_id: string]: number;
}

export class BotManager {
    messageBus = new EventEmitter(); //子进程消息事件总线
    botProcessList: BotProcessList = {};
    botProcessPidList: BotProcessPidList = {};
    internalData: { [botId: string]: { [messageType: string]: C2MProcessTransportData } } = {}; //根据botId和messageType索引的容器

    registerMessageBus() {
        //心跳事件
        this.messageBus.on("heartbeat", (msg: C2MProcessTransportData) => {
            const m: M2CProcessTransportData = { type: "heartbeat" };
            this.botProcessList[msg.botId]?.send(m);
        });
        //内部事件
        this.messageBus.on("internal", (msg: C2MProcessTransportData) => {
            if (msg.type === 'internal' && 'internalType' in msg && 'message' in msg) {
                const messageType = msg.internalType as string;
                this.internalData[msg.botId] = this.internalData[msg.botId] || {};
                // @ts-ignore
                this.internalData[msg.botId][messageType] = msg;
            }
        });
        // 配置变更事件：子进程上报配置更改 → 写入本地配置文件
        this.messageBus.on("config:update", async (msg: C2MProcessTransportData & { config?: Partial<BotConfig> }) => {
            if (!msg.config || Object.keys(msg.config).length === 0) return;
            try {
                const mgr = this.configFactory.create(ConfigType.BOT, msg.botId);
                await mgr.write(msg.config);
            } catch (err) {
                console.error(`[BotManager] 同步配置失败 bot=${msg.botId}:`, err);
            }
        });
    }

    private botScriptPath: string;
    private configFactory!: ConfigManagerFactory;

    constructor(configFactoryOrScriptPath?: ConfigManagerFactory | string) {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        if (configFactoryOrScriptPath && typeof configFactoryOrScriptPath === 'object') {
            // 传入 ConfigManagerFactory
            this.configFactory = configFactoryOrScriptPath;
            this.botScriptPath = resolve(__dirname, 'bots', 'dist', 'bot.js');
        } else {
            // 兼容旧式调用：传入 botScriptPath（string）或不传
            this.botScriptPath = (configFactoryOrScriptPath as string | undefined) ?? resolve(__dirname, 'bots', 'dist', 'bot.js');
            // 如果没有 configFactory，startBot 无法工作，留到 startBot 时抛错
        }
    }

    // 延迟注入 configFactory（用于旧式构造后配置）
    setConfigFactory(factory: ConfigManagerFactory): void {
        this.configFactory = factory;
    }

    /**
     * 通过 botId 从配置文件读取完整配置，然后启动子进程
     * @param botId  Bot UUID
     */
    async startBot(botId: string): Promise<void> {
        if (!this.configFactory) {
            throw new Error('[BotManager] ConfigManagerFactory 未设置，无法启动 Bot');
        }

        // 从配置文件读取 Bot 配置
        const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
        const config = await mgr.read();

        // fork 子进程（仅传 botId 作为标识，详细配置通过 IPC 发送）
        const botChildProcess = fork(this.botScriptPath, [botId]);

        if (botChildProcess.pid) {
            this.botProcessPidList[botId] = botChildProcess.pid;
        }

        botChildProcess.on("message", (msg: unknown) => {
            if (!isC2MProcessTransportData(msg)) {
                return;
            }
            this.messageBus.emit(msg.type, msg);
        });

        this.botProcessList[botId] = botChildProcess;

        // 等待子进程就绪后，通过 IPC 发送完整配置
        // 使用 setImmediate 确保 fork 已完成内部初始化
        await new Promise<void>(resolve => setImmediate(resolve));
        const initMsg: M2CProcessTransportData = {
            type: 'init',
            config,
        };
        botChildProcess.send(initMsg);
    }

    /**
     * 获取指定 bot 子进程的 pid
     * @param bot_id bot id
     * @param timeoutMs 超时时间（毫秒），默认 5000ms
     * @returns 如果成功获取返回 pid；若 bot 不存在、子进程已退出或超时则返回 -1
     */
    async getBotProcessPid(bot_id: string, timeoutMs: number = 5000): Promise<number> {
        const child = this.botProcessList[bot_id];
        if (!child || child.killed || child.exitCode !== null) {
            return -1;
        }
        if (this.internalData[bot_id]?.pid) {
            delete this.internalData[bot_id].pid;
        }
        child.send({ type: 'internal:pid' });
        try {
            const pid = await new Promise<number>((resolve, reject) => {
                const start = Date.now();

                const check = () => {
                    const msg = this.internalData[bot_id]?.pid;
                    if (msg && msg.message && typeof msg.message.pid === 'number') {
                        // 拿到有效 pid，清理缓存后返回
                        if (this.internalData[bot_id]?.pid) {
                            delete this.internalData[bot_id]!.pid;  // 已知 bot_id 条目存在，用 ! 断言
                        }
                        resolve(msg.message.pid);
                        return;
                    }
                    // 超时判断
                    if (Date.now() - start >= timeoutMs) {
                        reject(new Error('timeout'));
                        return;
                    }

                    // 再次检查子进程是否存活，若中途退出则直接失败
                    if (child.killed || child.exitCode !== null) {
                        reject(new Error('process exited'));
                        return;
                    }
                    // 等待下一轮事件循环再检查（避免阻塞）
                    setImmediate(check);
                };
                check();
            });
            return pid;
        } catch {
            // 超时或进程异常退出，返回 -1
            return -1;
        }
    }

    /**
     * 清理超时未响应的子进程
     * - 向所有子进程请求 pid
     * - 在 requestTimeoutMs 内未收到响应的进程视为无响应
     * - 先发送 SIGTERM，等待 gracePeriodMs 后若仍存活则强杀
     * - 兼容 Windows / Linux
     */
    async cleanupUnresponsiveBots(
        requestTimeoutMs: number = 5000,
        gracePeriodMs: number = 5000
    ): Promise<void> {
        const unresponsiveBots: string[] = [];
        for (const botId of Object.keys(this.botProcessList)) {
            if (this.internalData[botId]?.pid) {
                delete this.internalData[botId].pid;
            }
        }
        for (const [botId, child] of Object.entries(this.botProcessList)) {
            if (child.killed || child.exitCode !== null) {
                continue; // 已经退出的不处理
            }
            child.send({ type: 'internal:pid' });
        }
        const start = Date.now();
        const requiredBots = Object.keys(this.botProcessList).filter(
            id => !this.botProcessList[id]?.killed && this.botProcessList[id]?.exitCode === null
        );
        await new Promise<void>(resolve => {
            const check = () => {
                // 所有存活子进程均已响应，或超时
                const allResponded = requiredBots.every(botId => {
                    const child = this.botProcessList[botId];
                    if (!child || child.killed || child.exitCode !== null) return true; // 已退出视为不再需要
                    return !!this.internalData[botId]?.pid;
                });

                if (allResponded || Date.now() - start >= requestTimeoutMs) {
                    resolve();
                    return;
                }
                setImmediate(check);
            };
            check();
        });
        for (const botId of requiredBots) {
            const child = this.botProcessList[botId];
            if (!child || child.killed || child.exitCode !== null) continue;
            const pidMsg = this.internalData[botId]?.pid;
            if (!pidMsg || typeof pidMsg?.message?.pid !== 'number') {
                unresponsiveBots.push(botId);
            }
        }
        for (const botId of unresponsiveBots) {
            const child = this.botProcessList[botId];
            if (!child || child.killed || child.exitCode !== null) continue;

            const pid = child.pid!; // 记录 pid 用于强杀

            // 优雅终止
            try {
                child.kill('SIGTERM');
            } catch {
                // 在 Windows 上忽略信号参数错误，kill 本身仍会尝试终止
            }

            // 等待 gracePeriodMs
            await new Promise<void>(resolve => {
                const deadline = Date.now() + gracePeriodMs;
                const waitExit = () => {
                    if (child.killed || child.exitCode !== null) {
                        resolve();
                        return;
                    }
                    if (Date.now() >= deadline) {
                        resolve(); // 超时，进入强杀阶段
                        return;
                    }
                    setImmediate(waitExit);
                };
                waitExit();
            });

            // 若仍然存活，强杀
            if (!child.killed && child.exitCode === null) {
                if (os.platform() === 'win32') {
                    try {
                        await execPromise(`taskkill /F /T /PID ${pid}`);
                    } catch (e) {
                        // 忽略 taskkill 错误
                    }
                } else {
                    try {
                        child.kill('SIGKILL');
                    } catch {
                        // 忽略错误
                    }
                }
            }

            // 清理管理结构
            delete this.botProcessList[botId];
            delete this.botProcessPidList[botId];
            delete this.internalData[botId];
        }
    }

    /**
     * 清理超过指定时间未处理的 internalData
     * @param maxAgeMs 最大存活时间（毫秒），默认为 1 分钟
     */
    clearStaleInternalData(maxAgeMs: number = 60000): void {
        const now = Date.now();
        for (const botId of Object.keys(this.internalData)) {
            const botMessages = this.internalData[botId];
            let hasRemaining = false;
            if (!botMessages) continue;
            for (const msgType of Object.keys(botMessages)) {
                const msg = botMessages[msgType];
                // 检查消息是否超时
                if (msg && now - msg.timestamp > maxAgeMs) {
                    delete botMessages[msgType];
                } else if (msg) {
                    hasRemaining = true;
                }
            }
            // 如果该 botId 下没有任何消息了，则删除该 botId 的条目
            if (!hasRemaining) {
                delete this.internalData[botId];
            }
        }
    }

    // ─── 配置同步 ─────────────────────────────────────────────────────────────

    /**
     * 向指定 Bot 子进程推送配置更新，同时写入本地配置文件
     * @param botId  Bot UUID
     * @param patch  要更新的配置字段（Partial）
     */
    async pushConfig(botId: string, patch: Partial<BotConfig>): Promise<void> {
        const child = this.botProcessList[botId];
        if (!child || child.killed || child.exitCode !== null) {
            console.warn(`[BotManager] Bot ${botId} 未运行，仅更新配置文件`);
        }

        // 1. 更新本地配置文件
        try {
            const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
            await mgr.write(patch);
        } catch (err) {
            console.error(`[BotManager] 写入配置失败 bot=${botId}:`, err);
            return;
        }

        // 2. 向子进程推送配置
        if (child && !child.killed && child.exitCode === null) {
            const pushMsg: M2CProcessTransportData = {
                type: 'config:push',
                config: patch,
            };
            child.send(pushMsg);
        }
    }

    /**
     * 获取指定 Bot 的完整配置（从文件读取）
     * @param botId  Bot UUID
     */
    async getBotConfig(botId: string): Promise<BotConfig | null> {
        if (!this.configFactory) return null;
        try {
            const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
            return await mgr.read();
        } catch {
            return null;
        }
    }
}