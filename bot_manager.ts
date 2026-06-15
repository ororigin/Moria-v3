import { spawn, exec, execFile, fork, ChildProcess } from 'child_process';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { C2MProcessTransportData, M2CProcessTransportData, InternalData } from './type/transport.js';
import { isM2CProcessTransportData, isC2MProcessTransportData, isInternalData } from './type/transport.js';
import type { ConfigManagerFactory } from './storage/config/factory/ConfigManagerFactory.js';
import { ConfigType } from './storage/config/factory/ConfigType.js';
import type { BotConfig } from './storage/config/types/BotConfig.js';
import { BotStatus } from './storage/config/types/BotStatus.js';
import { promisify } from 'util';
import os from 'os';

const execPromise = promisify(exec);

//子进程管理条目（运行时状态，不持久化）
interface BotProcessEntry {
    process: ChildProcess;
    pid: number;                 // 创建时从 child.pid 写入，可被 IPC 确认更新
    status: BotStatus;           // 当前运行时状态
    lastHeartbeat: number;       // 最后收到心跳的时间戳
    startTime: number;           // 条目创建（启动）时间戳
}

// Bot 信息响应结构（用于 API 输出，不包含 password）
export interface BotInfoResponse {
    id: string;
    name: string;
    server: string;
    port: number;
    status: string;         // BotStatus 的中文值："在线" | "离线" | "启动中" | "错误"
    is_active: boolean;     // 进程是否存活
    last_activity: string;  // ISO 8601
    created_at: string;     // ISO 8601
}

export class BotManager {
    messageBus = new EventEmitter(); //子进程消息事件总线
    botProcesses: { [botId: string]: BotProcessEntry } = {};
    internalData: { [botId: string]: { [messageType: string]: C2MProcessTransportData } } = {}; //根据botId和messageType索引的容器

    registerMessageBus() {
        //心跳事件：记录最后心跳时间并回复
        this.messageBus.on("heartbeat", (msg: C2MProcessTransportData) => {
            const entry = this.botProcesses[msg.botId];
            if (entry) {
                entry.lastHeartbeat = Date.now();
            }
            const m: M2CProcessTransportData = { type: "heartbeat" };
            this.botProcesses[msg.botId]?.process.send(m);
        });
        //子进程状态变更事件
        this.messageBus.on("status", (msg: C2MProcessTransportData & { status?: string }) => {
            const entry = this.botProcesses[msg.botId];
            if (!entry || !msg.status) return;
            switch (msg.status) {
                case 'starting':
                    entry.status = BotStatus.STARTING;
                    break;
                case 'online':
                    entry.status = BotStatus.ONLINE;
                    break;
                case 'offline':
                    entry.status = BotStatus.OFFLINE;
                    break;
            }
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
     * @param force  是否强制重新启动。如果为 true 且 bot 进程存活，先终止再重新启动
     * @throws 当 bot 非离线状态且 force=false 时抛出错误
     */
    async startBot(botId: string, force: boolean = false): Promise<void> {
        if (!this.configFactory) {
            throw new Error('[BotManager] ConfigManagerFactory 未设置，无法启动 Bot');
        }

        const existingEntry = this.botProcesses[botId];
        const isRunning = existingEntry &&
            !existingEntry.process.killed &&
            existingEntry.process.exitCode === null;

        if (isRunning) {
            if (!force) {
                throw new Error(
                    `[BotManager] Bot ${botId} 当前状态为 ${existingEntry.status}，` +
                    '无法启动（仅允许在离线状态下启动）。如需强制重启请设置 force=true'
                );
            }

            // force=true：强制终止现有进程
            const child = existingEntry.process;
            const pid = existingEntry.pid;

            // 先尝试优雅关闭
            try {
                child.kill('SIGTERM');
            } catch {
                // Windows 上忽略信号错误
            }

            // 等待进程退出（最多 5 秒）
            await new Promise<void>((resolve) => {
                const deadline = Date.now() + 5000;
                const waitExit = () => {
                    if (child.killed || child.exitCode !== null) {
                        resolve();
                        return;
                    }
                    if (Date.now() >= deadline) {
                        resolve();
                        return;
                    }
                    setImmediate(waitExit);
                };
                waitExit();
            });

            // 若仍未退出则强杀
            if (!child.killed && child.exitCode === null) {
                if (os.platform() === 'win32') {
                    try {
                        await execPromise(`taskkill /F /T /PID ${pid}`);
                    } catch {
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

            // 清理旧条目
            delete this.botProcesses[botId];
            delete this.internalData[botId];
        }

        // 从配置文件读取 Bot 配置
        const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
        const config = await mgr.read();

        // fork 子进程（仅传 botId 作为标识，详细配置通过 IPC 发送）
        const botChildProcess = fork(this.botScriptPath, [botId]);

        botChildProcess.on("message", (msg: unknown) => {
            if (!isC2MProcessTransportData(msg)) {
                return;
            }
            this.messageBus.emit(msg.type, msg);
        });

        const now = Date.now();
        this.botProcesses[botId] = {
            process: botChildProcess,
            pid: botChildProcess.pid ?? 0,
            status: BotStatus.STARTING,
            lastHeartbeat: now,
            startTime: now,
        };

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
        const entry = this.botProcesses[bot_id];
        const child = entry?.process;
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
                        // 拿到有效 pid，用 IPC 确认的 pid 覆盖条目中的记录
                        if (entry) {
                            entry.pid = msg.message.pid;
                        }
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
        for (const botId of Object.keys(this.botProcesses)) {
            if (this.internalData[botId]?.pid) {
                delete this.internalData[botId].pid;
            }
        }
        for (const [botId, entry] of Object.entries(this.botProcesses)) {
            const child = entry.process;
            if (child.killed || child.exitCode !== null) {
                continue; // 已经退出的不处理
            }
            child.send({ type: 'internal:pid' });
        }
        const start = Date.now();
        const requiredBots = Object.keys(this.botProcesses).filter(
            id => {
                const e = this.botProcesses[id];
                return e && !e.process.killed && e.process.exitCode === null;
            }
        );
        await new Promise<void>(resolve => {
            const check = () => {
                // 所有存活子进程均已响应，或超时
                const allResponded = requiredBots.every(botId => {
                    const e = this.botProcesses[botId];
                    if (!e || e.process.killed || e.process.exitCode !== null) return true; // 已退出视为不再需要
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
            const e = this.botProcesses[botId];
            if (!e || e.process.killed || e.process.exitCode !== null) continue;
            const pidMsg = this.internalData[botId]?.pid;
            if (!pidMsg || typeof pidMsg?.message?.pid !== 'number') {
                unresponsiveBots.push(botId);
            }
        }
        for (const botId of unresponsiveBots) {
            const entry = this.botProcesses[botId];
            if (!entry || entry.process.killed || entry.process.exitCode !== null) continue;

            const child = entry.process;
            const pid = entry.pid; // 优先使用独立存储的 pid（可能已被 IPC 确认更新）

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
            delete this.botProcesses[botId];
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
        const entry = this.botProcesses[botId];
        const child = entry?.process;
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

    // ─── 运行时状态查询 ──────────────────────────────────────────────────────

    /**
     * 获取当前在线 Bot 数量（状态为 ONLINE）
     */
    getOnlineCount(): number {
        return Object.values(this.botProcesses).filter(
            e => e.status === BotStatus.ONLINE
        ).length;
    }

    /**
     * 获取所有已注册 Bot 总数（从配置文件统计）
     */
    async getTotalCount(): Promise<number> {
        if (!this.configFactory) return 0;
        try {
            const names = await this.configFactory.listAll(ConfigType.BOT);
            return names.length;
        } catch {
            return 0;
        }
    }

    /**
     * 获取单个 Bot 的综合信息（配置 + 运行时状态）
     * @returns 与 v2 API 兼容的信息对象，不含 password
     */
    async getBotInfo(botId: string): Promise<BotInfoResponse | null> {
        if (!this.configFactory) return null;
        try {
            const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
            const config = await mgr.read();
            const entry = this.botProcesses[botId];
            const isActive = !!entry && !entry.process.killed && entry.process.exitCode === null;

            return {
                id: config.botId,
                name: config.name,
                server: config.server,
                port: config.port,
                status: entry?.status ?? BotStatus.OFFLINE,
                is_active: isActive,
                last_activity: config.updatedAt,
                created_at: config.createdAt,
            };
        } catch {
            return null;
        }
    }

    /**
     * 获取所有 Bot 的综合信息列表
     */
    async getAllBotsInfo(): Promise<BotInfoResponse[]> {
        if (!this.configFactory) return [];
        try {
            const names = await this.configFactory.listAll(ConfigType.BOT);
            const results: BotInfoResponse[] = [];
            for (const botId of names) {
                const info = await this.getBotInfo(botId);
                if (info) results.push(info);
            }
            return results;
        } catch {
            return [];
        }
    }
}