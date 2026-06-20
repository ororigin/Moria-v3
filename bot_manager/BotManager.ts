import { fork } from "child_process";
import crypto from "node:crypto";
import EventEmitter from "events";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type {
    C2MProcessTransportData,
    M2CProcessTransportData,
    InternalData,
} from "../type/transport.js";
import {
    isM2CProcessTransportData,
    isC2MProcessTransportData,
    isInternalData,
} from "../type/transport.js";
import type { ConfigManagerFactory } from "../storage/config/factory/ConfigManagerFactory.js";
import { ConfigType } from "../storage/config/factory/ConfigType.js";
import type { BotConfig } from "../storage/config/types/BotConfig.js";
import { BotStatus } from "../storage/config/types/BotStatus.js";
import type {
    BotProcessEntry,
    CreateBotResult,
    BotInfoResponse,
} from "./type/DataStructure.js";
import { waitForExit, isProcessAlive, forceKillProcess } from "./utils.js";
import { validateConfig } from "../storage/config/utils/ConfigValidator.js";
import Logger from "../storage/log/Logger.js";

export class BotManager {
    messageBus = new EventEmitter(); // 子进程消息事件总线
    botProcesses: { [botId: string]: BotProcessEntry } = {};
    internalData: {
        [botId: string]: { [messageType: string]: C2MProcessTransportData };
    } = {}; // 根据 botId 和 messageType 索引的容器
    private heartbeatMonitorTimer: ReturnType<typeof setInterval> | null = null;
    logger!: Logger;
    registerMessageBus() {
        // 心跳事件：记录最后心跳时间、同步 PID、重置失跳计数、回复确认
        this.messageBus.on(
            "heartbeat",
            (msg: C2MProcessTransportData & { pid?: number }) => {
                const entry = this.botProcesses[msg.botId];
                if (entry) {
                    entry.lastHeartbeat = Date.now();
                    entry.missedHeartbeats = 0;
                    // 子进程心跳附带 pid 时，覆盖条目中的记录
                    if (typeof msg.pid === "number" && msg.pid > 0) {
                        entry.pid = msg.pid;
                    }
                }
                const m: M2CProcessTransportData = { type: "heartbeat" };
                this.botProcesses[msg.botId]?.process.send(m);
            },
        );
        // 子进程状态变更事件
        this.messageBus.on(
            "status",
            (msg: C2MProcessTransportData & { status?: string }) => {
                const entry = this.botProcesses[msg.botId];
                if (!entry || !msg.status) return;
                switch (msg.status) {
                    case "starting":
                        entry.status = BotStatus.STARTING;
                        break;
                    case "online":
                        entry.status = BotStatus.ONLINE;
                        break;
                    case "offline":
                        entry.status = BotStatus.OFFLINE;
                        break;
                }
            },
        );
        // 内部事件
        this.messageBus.on("internal", (msg: C2MProcessTransportData) => {
            if (
                msg.type === "internal" &&
                "internalType" in msg &&
                "message" in msg
            ) {
                const messageType = msg.internalType as string;
                this.internalData[msg.botId] =
                    this.internalData[msg.botId] || {};
                // @ts-ignore
                this.internalData[msg.botId][messageType] = msg;
            }
        });
        // 配置变更事件：子进程上报配置更改 → 写入本地配置文件
        this.messageBus.on(
            "config:update",
            async (
                msg: C2MProcessTransportData & { config?: Partial<BotConfig> },
            ) => {
                if (!msg.config || Object.keys(msg.config).length === 0) return;
                try {
                    const mgr = this.configFactory.create(
                        ConfigType.BOT,
                        msg.botId,
                    );
                    await mgr.write(msg.config);
                } catch (err) {
                    this.logger?.sysLog(
                        "error",
                        "BotManager",
                        `同步配置失败 bot=${msg.botId}: ${err}`,
                    );
                }
            },
        );
        // 聊天消息事件：子进程上报游戏内聊天 → 写入日志
        this.messageBus.on(
            "chat",
            (msg: C2MProcessTransportData & { message?: string }) => {
                if (!msg.message) return;
                this.logger?.log(msg.botId, "chat", msg.message);
            },
        );
        // 日志事件：子进程上报运行日志 → 按 bot 分文件存储
        this.messageBus.on(
            "log",
            (
                msg: C2MProcessTransportData & {
                    message?: string;
                    level?: string;
                },
            ) => {
                if (!msg.message) return;
                this.logger?.log(msg.botId, "log", msg.message);
                if (msg.level === "error" || msg.level === "warn") {
                    this.logger?.sysLog(
                        msg.level as any,
                        `Bot-${msg.botId}`,
                        msg.message,
                    );
                }
            },
        );
    }

    private botScriptPath: string;
    private configFactory!: ConfigManagerFactory;

    constructor(configFactoryOrScriptPath?: ConfigManagerFactory | string) {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        if (
            configFactoryOrScriptPath &&
            typeof configFactoryOrScriptPath === "object"
        ) {
            // 传入 ConfigManagerFactory
            this.configFactory = configFactoryOrScriptPath;
            this.botScriptPath = resolve(__dirname, "bots", "dist", "bot.js");
        } else {
            // 兼容旧式调用：传入 botScriptPath（string）或不传
            this.botScriptPath =
                (configFactoryOrScriptPath as string | undefined) ??
                resolve(__dirname, "bots", "dist", "bot.js");
            // 如果没有 configFactory，startBot 无法工作，留到 startBot 时抛错
        }
    }

    // 延迟注入 configFactory（用于旧式构造后配置）
    setConfigFactory(factory: ConfigManagerFactory): void {
        this.configFactory = factory;
    }

    // 延迟注入 Logger（用于旧式构造后配置）
    setLogger(logger: Logger): void {
        this.logger = logger;
    }

    /**
     * 通过 botId 从配置文件读取完整配置，然后启动子进程
     * @param botId  Bot UUID
     * @param force  是否强制重新启动。如果为 true 且 bot 进程存活，先终止再重新启动
     * @throws 当 bot 非离线状态且 force=false 时抛出错误
     */
    async startBot(botId: string, force: boolean = false): Promise<void> {
        if (!this.configFactory) {
            throw new Error(
                "[BotManager] ConfigManagerFactory 未设置，无法启动 Bot",
            );
        }

        const existingEntry = this.botProcesses[botId];

        if (existingEntry && isProcessAlive(existingEntry.process)) {
            if (!force) {
                throw new Error(
                    `[BotManager] Bot ${botId} 当前状态为 ${existingEntry.status}，` +
                        "无法启动（仅允许在离线状态下启动）。如需强制重启请设置 force=true",
                );
            }

            // force=true：强制终止现有进程
            await forceKillProcess(
                existingEntry.process,
                existingEntry.pid,
                5000,
            );

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
            missedHeartbeats: 0,
        };

        // 等待子进程就绪后，通过 IPC 发送完整配置
        // 使用 setImmediate 确保 fork 已完成内部初始化
        await new Promise<void>((resolve) => setImmediate(resolve));
        const initMsg: M2CProcessTransportData = {
            type: "init",
            config,
        };
        botChildProcess.send(initMsg);
        this.logger?.sysLog("info", "BotManager", `Bot ${botId} 已启动`);
    }

    /**
     * 获取指定 bot 子进程的 pid
     * @param bot_id bot id
     * @param timeoutMs 超时时间（毫秒），默认 5000ms
     * @returns 如果成功获取返回 pid；若 bot 不存在、子进程已退出或超时则返回 -1
     */
    async getBotProcessPid(
        bot_id: string,
        timeoutMs: number = 5000,
    ): Promise<number> {
        const entry = this.botProcesses[bot_id];
        const child = entry?.process;
        if (!child || child.killed || child.exitCode !== null) {
            return -1;
        }
        if (this.internalData[bot_id]?.pid) {
            delete this.internalData[bot_id].pid;
        }
        child.send({ type: "internal:pid" });
        try {
            const pid = await new Promise<number>((resolve, reject) => {
                const start = Date.now();

                const check = () => {
                    const msg = this.internalData[bot_id]?.pid;
                    if (
                        msg &&
                        msg.message &&
                        typeof msg.message.pid === "number"
                    ) {
                        // 拿到有效 pid，用 IPC 确认的 pid 覆盖条目中的记录
                        if (entry) {
                            entry.pid = msg.message.pid;
                        }
                        if (this.internalData[bot_id]?.pid) {
                            delete this.internalData[bot_id]!.pid; // 已知 bot_id 条目存在，用 ! 断言
                        }
                        resolve(msg.message.pid);
                        return;
                    }
                    // 超时判断
                    if (Date.now() - start >= timeoutMs) {
                        reject(new Error("timeout"));
                        return;
                    }

                    // 再次检查子进程是否存活，若中途退出则直接失败
                    if (child.killed || child.exitCode !== null) {
                        reject(new Error("process exited"));
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
     * 清理超时未响应的子进程（基于 lastHeartbeat 时间戳判断）
     * - 检查所有存活子进程的 lastHeartbeat 是否在指定超时内
     * - 超时的进程先 SIGTERM，等待 gracePeriodMs 后若仍存活则强杀
     * - 兼容 Windows / Linux
     *
     * @param heartbeatTimeoutMs  心跳超时阈值（毫秒），默认 20s
     * @param gracePeriodMs       强杀阶段等待时间（毫秒），默认 5000
     */
    async cleanupUnresponsiveBots(
        heartbeatTimeoutMs: number = 20000,
        gracePeriodMs: number = 5000,
    ): Promise<void> {
        const now = Date.now();
        for (const [botId, entry] of Object.entries(this.botProcesses)) {
            if (!isProcessAlive(entry.process)) {
                // 进程已退出，清理残留条目
                delete this.botProcesses[botId];
                delete this.internalData[botId];
                continue;
            }

            const elapsed = now - entry.lastHeartbeat;
            if (elapsed <= heartbeatTimeoutMs) continue;

            this.logger?.sysLog(
                "warn",
                "BotManager",
                `Bot ${botId} 心跳超时 (${elapsed}ms)，执行清理`,
            );

            await forceKillProcess(entry.process, entry.pid, gracePeriodMs);

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
     * 获取指定 Bot 的运行日志或聊天记录
     *
     * 底层调用 Logger.read()，日志文件命名规则：
     *   - type="log"  → 读取 `<botId>-log.log`（运行日志）
     *   - type="chat" → 读取 `<botId>-chat.log`（聊天记录）
     *
     * @param botId     Bot UUID
     * @param type      日志类型：`"log"`（运行日志）或 `"chat"`（聊天记录）
     * @param lineCount 返回行数，默认 50
     * @returns 日志行数组，每行格式为 `[YYYY-MM-DD HH:mm:ss]消息内容`
     */
    async getBotLog(
        botId: string,
        type: "log" | "chat",
        lineCount: number = 50,
    ): Promise<string[]> {
        if (!this.logger) {
            return [];
        }
        if (type !== "log" && type !== "chat") {
            return [];
        }
        if (lineCount <= 0) {
            lineCount = 50;
        }
        return this.logger.read(botId, type, lineCount);
    }

    /**
     * 启动心跳监控定时器
     * - 定时检查所有子进程的 lastHeartbeat，维护 missedHeartbeats 计数
     * - 连续失跳达到阈值后自动清理
     *
     * @param intervalMs    检查间隔（毫秒），默认 5000
     * @param timeoutMs     单次心跳超时阈值（毫秒），默认 15000
     * @param maxMissed     最大连续失跳次数，超过后执行清理，默认 3
     */
    startHeartbeatMonitor(
        intervalMs: number = 5000,
        timeoutMs: number = 15000,
        maxMissed: number = 3,
    ): void {
        if (this.heartbeatMonitorTimer) {
            this.logger?.sysLog(
                "warn",
                "BotManager",
                "心跳监控已启动，跳过重复启动",
            );
            return;
        }

        this.heartbeatMonitorTimer = setInterval(() => {
            const now = Date.now();

            for (const [botId, entry] of Object.entries(this.botProcesses)) {
                // 进程已退出，直接清理
                if (!isProcessAlive(entry.process)) {
                    delete this.botProcesses[botId];
                    delete this.internalData[botId];
                    continue;
                }

                const elapsed = now - entry.lastHeartbeat;

                if (elapsed > timeoutMs) {
                    entry.missedHeartbeats++;

                    if (entry.missedHeartbeats >= maxMissed) {
                        this.logger?.sysLog(
                            "warn",
                            "BotManager",
                            `Bot ${botId} 连续 ${entry.missedHeartbeats} 次心跳失联，上次心跳距今 ${elapsed}ms，执行清理`,
                        );
                        entry.status = BotStatus.ERROR;

                        // 异步清理（不阻塞定时器循环）
                        this.cleanupUnresponsiveBots(timeoutMs).catch((err) => {
                            this.logger?.sysLog(
                                "error",
                                "BotManager",
                                `清理 Bot ${botId} 失败: ${err}`,
                            );
                        });
                    }
                } else {
                    // 心跳正常，重置失跳计数
                    entry.missedHeartbeats = 0;
                }
            }
        }, intervalMs);

        // 允许定时器不阻止进程退出
        if (
            this.heartbeatMonitorTimer &&
            typeof this.heartbeatMonitorTimer === "object" &&
            "unref" in this.heartbeatMonitorTimer
        ) {
            this.heartbeatMonitorTimer.unref();
        }
    }

    /**
     * 停止心跳监控定时器
     */
    stopHeartbeatMonitor(): void {
        if (this.heartbeatMonitorTimer) {
            clearInterval(this.heartbeatMonitorTimer);
            this.heartbeatMonitorTimer = null;
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
        options?: { timeout?: number; gracePeriodMs?: number },
    ): Promise<{ success: boolean; message: string; pid?: number }> {
        const entry = this.botProcesses[botId];
        if (!entry || !isProcessAlive(entry.process)) {
            if (this.botProcesses[botId]) delete this.botProcesses[botId];
            if (this.internalData[botId]) delete this.internalData[botId];
            const result: { success: boolean; message: string; pid?: number } =
                {
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
        const stopMsg: M2CProcessTransportData = { type: "stop" };
        child.send(stopMsg);
        await waitForExit(child, timeout);
        if (isProcessAlive(child)) {
            await forceKillProcess(child, pid, gracePeriodMs);
        }

        delete this.botProcesses[botId];
        delete this.internalData[botId];

        this.logger?.sysLog("info", "BotManager", `Bot ${botId} 已停止`);
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
            this.logger?.sysLog(
                "warn",
                "BotManager",
                `Bot ${botId} 未运行，仅更新配置文件`,
            );
        }
        try {
            const mgr = this.configFactory.create<BotConfig>(
                ConfigType.BOT,
                botId,
            );
            await mgr.write(patch);
        } catch (err) {
            this.logger?.sysLog(
                "error",
                "BotManager",
                `写入配置失败 bot=${botId}: ${err}`,
            );
            return;
        }
        if (child && !child.killed && child.exitCode === null) {
            const pushMsg: M2CProcessTransportData = {
                type: "config:push",
                config: patch,
            };
            child.send(pushMsg);
        }
    }

    /**
     * 向指定 Bot 子进程发送聊天命令
     * @param botId   Bot UUID
     * @param command 要发送的聊天消息
     * @returns 是否成功发送（false 表示 bot 未运行）
     */
    async sendCommand(botId: string, command: string): Promise<boolean> {
        const entry = this.botProcesses[botId];
        if (!entry || !isProcessAlive(entry.process)) {
            this.logger?.sysLog(
                "warn",
                "BotManager",
                `Bot ${botId} 未在运行，无法发送命令`,
            );
            return false;
        }
        const msg: M2CProcessTransportData = {
            type: "chat",
            msg: command,
        };
        entry.process.send(msg);
        this.logger?.sysLog(
            "info",
            "BotManager",
            `命令已发送到 Bot ${botId}: ${command}`,
        );
        return true;
    }

    /**
     * 向指定 Bot 子进程发送预设动作指令
     *
     * action 名称由 bot 模块端通过 static actionName 注册，
     * 可通过 params 传递可选的结构化参数。
     *
     * @param botId       Bot UUID
     * @param action      action 名称（如 'mountMinecart', 'dismount'）
     * @param params      可选的结构化参数，传递给 bot 命令执行
     * @returns 是否成功发送（false 表示 bot 未运行）
     */
    async executeAction(
        botId: string,
        action: string,
        params?: Record<string, any>,
    ): Promise<boolean> {
        const entry = this.botProcesses[botId];
        if (!entry || !isProcessAlive(entry.process)) {
            this.logger?.sysLog(
                "warn",
                "BotManager",
                `Bot ${botId} 未在运行，无法执行动作`,
            );
            return false;
        }
        const msg: M2CProcessTransportData = {
            type: "action",
            action,
            ...(params && Object.keys(params).length > 0 ? { params } : {}),
        };
        entry.process.send(msg);
        this.logger?.sysLog(
            "info",
            "BotManager",
            `动作 ${action} 已发送到 Bot ${botId}`,
        );
        return true;
    }

    /**
     * 创建新的 Bot 配置
     * @param configJson  JSON 格式的配置字符串（支持 BotConfig 的子集字段）
     * @returns           新 Bot 的 botId 和完整配置
     * @throws            JSON 格式非法时抛出错误
     * @throws            配置字段校验失败时抛出错误
     * @throws            ConfigManagerFactory 未设置时抛出错误
     */
    async createBot(configJson: string): Promise<CreateBotResult> {
        if (!this.configFactory) {
            throw new Error(
                "[BotManager] ConfigManagerFactory 未设置，无法创建 Bot",
            );
        }

        // 校验 JSON 格式与字段合法性（partial 模式：只校验存在的字段）
        const result = validateConfig<Partial<BotConfig>>(
            ConfigType.BOT,
            configJson,
            {
                mode: "partial",
                allowUnknown: false,
            },
        );
        if (!result.success) {
            throw new Error(
                `[BotManager] 配置校验失败: ${result.errors.join("; ")}`,
            );
        }

        const botId = crypto.randomUUID();
        const mgr = this.configFactory.create<BotConfig>(ConfigType.BOT, botId);
        await mgr.read();
        const finalConfig = await mgr.write(result.data!);
        this.logger?.sysLog("info", "BotManager", `Bot ${botId} 已创建`);
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
        options?: { force?: boolean },
    ): Promise<{ success: boolean; message: string; botId: string }> {
        if (!this.configFactory) {
            throw new Error(
                "[BotManager] ConfigManagerFactory 未设置，无法删除 Bot",
            );
        }

        const entry = this.botProcesses[botId];
        if (entry && isProcessAlive(entry.process)) {
            if (!options?.force) {
                throw new Error(
                    `[BotManager] Bot ${botId} 仍在运行，请先停止或设置 force=true`,
                );
            }
            // force=true 时自动停止进程
            await this.stopBot(botId);
        }
        // 删除配置文件（文件不存在时 mgr.delete() 内部跳过，不抛错）
        try {
            const mgr = this.configFactory.create<BotConfig>(
                ConfigType.BOT,
                botId,
            );
            await mgr.delete();
        } catch (err) {
            this.logger?.sysLog(
                "warn",
                "BotManager",
                `删除配置文件失败 bot=${botId}: ${err}`,
            );
        }

        // 确保内存条目已清理
        delete this.botProcesses[botId];
        delete this.internalData[botId];

        this.logger?.sysLog("info", "BotManager", `Bot ${botId} 已删除`);
        return { success: true, message: `Bot ${botId} 已删除`, botId };
    }

    /**
     * 获取指定 Bot 的完整配置（从文件读取）
     * @param botId  Bot UUID
     */
    async getBotConfig(botId: string): Promise<BotConfig | null> {
        if (!this.configFactory) return null;
        try {
            const mgr = this.configFactory.create<BotConfig>(
                ConfigType.BOT,
                botId,
            );
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
            (e) => e.status === BotStatus.ONLINE,
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
            const mgr = this.configFactory.create<BotConfig>(
                ConfigType.BOT,
                botId,
            );
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
