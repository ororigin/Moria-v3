import { fork, type ChildProcess } from 'child_process';
import crypto from 'node:crypto';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { C2MProcessTransportData, M2CProcessTransportData, InternalData } from '../type/transport.js';
import { isM2CProcessTransportData, isC2MProcessTransportData, isInternalData } from '../type/transport.js';
import type { ConfigManagerFactory } from '../storage/config/factory/ConfigManagerFactory.js';
import { ConfigType } from '../storage/config/factory/ConfigType.js';
import type { BotConfig } from '../storage/config/types/BotConfig.js';
import { BotStatus } from '../storage/config/types/BotStatus.js';
import { waitForExit, isProcessAlive, forceKillProcess } from './utils.js';

//子进程管理条目（运行时状态，不持久化）
interface BotProcessEntry {
    process: ChildProcess;
    pid: number;                 // 创建时从 child.pid 写入，可被 IPC 确认更新
    status: BotStatus;           // 当前运行时状态
    lastHeartbeat: number;       // 最后收到心跳的时间戳
    startTime: number;           // 条目创建（启动）时间戳
}

/** createBot 输入参数 */
export interface CreateBotConfig {
    /** Minecraft 用户名 */
    name: string;
    /** 服务器地址 */
    server: string;
    /** 服务器端口 */
    port: number;
    /** 服务器密码（可选，不传则使用模板默认） */
    password?: string;
    /** 显示名称（可选，不传则默认同 name） */
    displayName?: string;
    /** 是否启用自动重连（可选） */
    autoReconnect?: boolean;
    /** 最大重连次数（可选） */
    maxReconnect?: number;
    /** 重连间隔毫秒（可选） */
    reconnectInterval?: number;
    /** 认证 Token（可选） */
    token?: string;
    /** 命令前缀（可选） */
    commandPrefix?: string;
    /** 是否启用（可选） */
    enabled?: boolean;
    /** 最大重试次数（可选） */
    maxRetries?: number;
    /** 权限列表（可选） */
    permissions?: string[];
    /** Webhook URL（可选） */
    webhookUrl?: string | null;
}

/** createBot 返回结果 */
export interface CreateBotResult {
    botId: string;
    config: BotConfig;
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

        if (existingEntry && isProcessAlive(existingEntry.process)) {
            if (!force) {
                throw new Error(
                    `[BotManager] Bot ${botId} 当前状态为 ${existingEntry.status}，` +
                    '无法启动（仅允许在离线状态下启动）。如需强制重启请设置 force=true'
                );
            }

            // force=true：强制终止现有进程
            await forceKillProcess(existingEntry.process, existingEntry.pid, 5000);

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
            if (!isProcessAlive(child)) {
                continue; // 已经退出的不处理
            }
            child.send({ type: 'internal:pid' });
        }
        const start = Date.now();
        const requiredBots = Object.keys(this.botProcesses).filter(
            id => isProcessAlive(this.botProcesses[id]?.process)
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
            if (!e || !isProcessAlive(e.process)) continue;
            const pidMsg = this.internalData[botId]?.pid;
            if (!pidMsg || typeof pidMsg?.message?.pid !== 'number') {
                unresponsiveBots.push(botId);
            }
        }
        for (const botId of unresponsiveBots) {
            const entry = this.botProcesses[botId];
            if (!entry || !isProcessAlive(entry.process)) continue;

            await forceKillProcess(entry.process, entry.pid, gracePeriodMs);

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


    /**
     * 停止指定 Bot 子进程
     * @param botId                Bot UUID
     * @param options.timeout      等待子进程优雅退出的超时时间（毫秒），默认 5000
     * @param options.gracePeriodMs  强杀阶段等待 SIGTERM 生效的时间（毫秒），默认 5000
     * @returns 停止结果 { success, message, pid? }
     */
    async stopBot(
        botId: string,
        options?: { timeout?: number; gracePeriodMs?: number }
    ): Promise<{ success: boolean; message: string; pid?: number }> {
        const entry = this.botProcesses[botId];
        if (!entry || !isProcessAlive(entry.process)) {
            if (this.botProcesses[botId]) delete this.botProcesses[botId];
            if (this.internalData[botId]) delete this.internalData[botId];
            const result: { success: boolean; message: string; pid?: number } = {
                success: true,
                message: `Bot ${botId} 当前不在运行状态`,
            };
            if (entry?.pid) result.pid = entry.pid;
            return result;
        }

        const child = entry.process;
        const timeout = options?.timeout ?? 5000;
        const gracePeriodMs = options?.gracePeriodMs ?? 5000;
        const pid = entry.pid;
        const stopMsg: M2CProcessTransportData = { type: 'stop' };
        child.send(stopMsg);
        await waitForExit(child, timeout);
        if (isProcessAlive(child)) {
            await forceKillProcess(child, pid, gracePeriodMs);
        }

        delete this.botProcesses[botId];
        delete this.internalData[botId];

        return {
            success: true,
            message: `Bot ${botId} 已停止`,
            pid,
        };
    }


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
        try {
            const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
            await mgr.write(patch);
        } catch (err) {
            console.error(`[BotManager] 写入配置失败 bot=${botId}:`, err);
            return;
        }
        if (child && !child.killed && child.exitCode === null) {
            const pushMsg: M2CProcessTransportData = {
                type: 'config:push',
                config: patch,
            };
            child.send(pushMsg);
        }
    }

    /**
     * 创建新的 Bot 配置
     * @param config  必填：name / server / port；其余可选
     * @returns       新 Bot 的 botId 和完整配置
     * @throws        当 ConfigManagerFactory 未设置时抛出错误
     */
    async createBot(config: CreateBotConfig): Promise<CreateBotResult> {
        if (!this.configFactory) {
            throw new Error('[BotManager] ConfigManagerFactory 未设置，无法创建 Bot');
        }
        const botId = crypto.randomUUID();
        const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
        await mgr.read();
        const finalConfig = await mgr.write(config);
        return { botId, config: finalConfig };
    }

    /**
     * 删除指定 Bot 的配置和运行时状态
     * @param botId               Bot UUID
     * @param options.force        如果为 true 且 bot 进程存活，自动停止后再删除；否则抛错
     * @throws                    ConfigManagerFactory 未设置时抛错
     * @throws                    Bot 进程存活且 force=false 时抛错
     */
    async deleteBot(
        botId: string,
        options?: { force?: boolean }
    ): Promise<{ success: boolean; message: string; botId: string }> {
        if (!this.configFactory) {
            throw new Error('[BotManager] ConfigManagerFactory 未设置，无法删除 Bot');
        }

        const entry = this.botProcesses[botId];
        if (entry && isProcessAlive(entry.process)) {
            if (!options?.force) {
                throw new Error(
                    `[BotManager] Bot ${botId} 仍在运行，请先停止或设置 force=true`
                );
            }
            // force=true 时自动停止进程
            await this.stopBot(botId);
        }
        // 删除配置文件（文件不存在时 mgr.delete() 内部跳过，不抛错）
        try {
            const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
            await mgr.delete();
        } catch (err) {
            console.warn(`[BotManager] 删除配置文件失败 bot=${botId}:`, err);
        }

        // 确保内存条目已清理
        delete this.botProcesses[botId];
        delete this.internalData[botId];

        return { success: true, message: `Bot ${botId} 已删除`, botId };
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
            const isActive = isProcessAlive(entry?.process);

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