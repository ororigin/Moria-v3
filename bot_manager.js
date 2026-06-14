import { spawn, exec, execFile, fork, ChildProcess } from 'child_process';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { isM2CProcessTransportData, isC2MProcessTransportData, isInternalData } from './type/transport.js';
import { ConfigType } from './storage/config/factory/ConfigType.js';
import { BotStatus } from './storage/config/types/BotStatus.js';
import { promisify } from 'util';
import os from 'os';
const execPromise = promisify(exec);
export class BotManager {
    messageBus = new EventEmitter(); //子进程消息事件总线
    botProcesses = {};
    internalData = {}; //根据botId和messageType索引的容器
    registerMessageBus() {
        //心跳事件：记录最后心跳时间并回复
        this.messageBus.on("heartbeat", (msg) => {
            const entry = this.botProcesses[msg.botId];
            if (entry) {
                entry.lastHeartbeat = Date.now();
            }
            const m = { type: "heartbeat" };
            this.botProcesses[msg.botId]?.process.send(m);
        });
        //子进程状态变更事件
        this.messageBus.on("status", (msg) => {
            const entry = this.botProcesses[msg.botId];
            if (!entry || !msg.status)
                return;
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
        this.messageBus.on("internal", (msg) => {
            if (msg.type === 'internal' && 'internalType' in msg && 'message' in msg) {
                const messageType = msg.internalType;
                this.internalData[msg.botId] = this.internalData[msg.botId] || {};
                // @ts-ignore
                this.internalData[msg.botId][messageType] = msg;
            }
        });
        // 配置变更事件：子进程上报配置更改 → 写入本地配置文件
        this.messageBus.on("config:update", async (msg) => {
            if (!msg.config || Object.keys(msg.config).length === 0)
                return;
            try {
                const mgr = this.configFactory.create(ConfigType.BOT, msg.botId);
                await mgr.write(msg.config);
            }
            catch (err) {
                console.error(`[BotManager] 同步配置失败 bot=${msg.botId}:`, err);
            }
        });
    }
    botScriptPath;
    configFactory;
    constructor(configFactoryOrScriptPath) {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        if (configFactoryOrScriptPath && typeof configFactoryOrScriptPath === 'object') {
            // 传入 ConfigManagerFactory
            this.configFactory = configFactoryOrScriptPath;
            this.botScriptPath = resolve(__dirname, 'bots', 'dist', 'bot.js');
        }
        else {
            // 兼容旧式调用：传入 botScriptPath（string）或不传
            this.botScriptPath = configFactoryOrScriptPath ?? resolve(__dirname, 'bots', 'dist', 'bot.js');
            // 如果没有 configFactory，startBot 无法工作，留到 startBot 时抛错
        }
    }
    // 延迟注入 configFactory（用于旧式构造后配置）
    setConfigFactory(factory) {
        this.configFactory = factory;
    }
    /**
     * 通过 botId 从配置文件读取完整配置，然后启动子进程
     * @param botId  Bot UUID
     */
    async startBot(botId) {
        if (!this.configFactory) {
            throw new Error('[BotManager] ConfigManagerFactory 未设置，无法启动 Bot');
        }
        // 从配置文件读取 Bot 配置
        const mgr = this.configFactory.create(ConfigType.BOT, botId);
        const config = await mgr.read();
        // fork 子进程（仅传 botId 作为标识，详细配置通过 IPC 发送）
        const botChildProcess = fork(this.botScriptPath, [botId]);
        botChildProcess.on("message", (msg) => {
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
        await new Promise(resolve => setImmediate(resolve));
        const initMsg = {
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
    async getBotProcessPid(bot_id, timeoutMs = 5000) {
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
            const pid = await new Promise((resolve, reject) => {
                const start = Date.now();
                const check = () => {
                    const msg = this.internalData[bot_id]?.pid;
                    if (msg && msg.message && typeof msg.message.pid === 'number') {
                        // 拿到有效 pid，用 IPC 确认的 pid 覆盖条目中的记录
                        if (entry) {
                            entry.pid = msg.message.pid;
                        }
                        if (this.internalData[bot_id]?.pid) {
                            delete this.internalData[bot_id].pid; // 已知 bot_id 条目存在，用 ! 断言
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
        }
        catch {
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
    async cleanupUnresponsiveBots(requestTimeoutMs = 5000, gracePeriodMs = 5000) {
        const unresponsiveBots = [];
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
        const requiredBots = Object.keys(this.botProcesses).filter(id => {
            const e = this.botProcesses[id];
            return e && !e.process.killed && e.process.exitCode === null;
        });
        await new Promise(resolve => {
            const check = () => {
                // 所有存活子进程均已响应，或超时
                const allResponded = requiredBots.every(botId => {
                    const e = this.botProcesses[botId];
                    if (!e || e.process.killed || e.process.exitCode !== null)
                        return true; // 已退出视为不再需要
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
            if (!e || e.process.killed || e.process.exitCode !== null)
                continue;
            const pidMsg = this.internalData[botId]?.pid;
            if (!pidMsg || typeof pidMsg?.message?.pid !== 'number') {
                unresponsiveBots.push(botId);
            }
        }
        for (const botId of unresponsiveBots) {
            const entry = this.botProcesses[botId];
            if (!entry || entry.process.killed || entry.process.exitCode !== null)
                continue;
            const child = entry.process;
            const pid = entry.pid; // 优先使用独立存储的 pid（可能已被 IPC 确认更新）
            // 优雅终止
            try {
                child.kill('SIGTERM');
            }
            catch {
                // 在 Windows 上忽略信号参数错误，kill 本身仍会尝试终止
            }
            // 等待 gracePeriodMs
            await new Promise(resolve => {
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
                    }
                    catch (e) {
                        // 忽略 taskkill 错误
                    }
                }
                else {
                    try {
                        child.kill('SIGKILL');
                    }
                    catch {
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
    clearStaleInternalData(maxAgeMs = 60000) {
        const now = Date.now();
        for (const botId of Object.keys(this.internalData)) {
            const botMessages = this.internalData[botId];
            let hasRemaining = false;
            if (!botMessages)
                continue;
            for (const msgType of Object.keys(botMessages)) {
                const msg = botMessages[msgType];
                // 检查消息是否超时
                if (msg && now - msg.timestamp > maxAgeMs) {
                    delete botMessages[msgType];
                }
                else if (msg) {
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
    async pushConfig(botId, patch) {
        const entry = this.botProcesses[botId];
        const child = entry?.process;
        if (!child || child.killed || child.exitCode !== null) {
            console.warn(`[BotManager] Bot ${botId} 未运行，仅更新配置文件`);
        }
        // 1. 更新本地配置文件
        try {
            const mgr = this.configFactory.create(ConfigType.BOT, botId);
            await mgr.write(patch);
        }
        catch (err) {
            console.error(`[BotManager] 写入配置失败 bot=${botId}:`, err);
            return;
        }
        // 2. 向子进程推送配置
        if (child && !child.killed && child.exitCode === null) {
            const pushMsg = {
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
    async getBotConfig(botId) {
        if (!this.configFactory)
            return null;
        try {
            const mgr = this.configFactory.create(ConfigType.BOT, botId);
            return await mgr.read();
        }
        catch {
            return null;
        }
    }
    // ─── 运行时状态查询 ──────────────────────────────────────────────────────
    /**
     * 获取当前在线 Bot 数量（状态为 ONLINE）
     */
    getOnlineCount() {
        return Object.values(this.botProcesses).filter(e => e.status === BotStatus.ONLINE).length;
    }
    /**
     * 获取所有已注册 Bot 总数（从配置文件统计）
     */
    async getTotalCount() {
        if (!this.configFactory)
            return 0;
        try {
            const names = await this.configFactory.listAll(ConfigType.BOT);
            return names.length;
        }
        catch {
            return 0;
        }
    }
    /**
     * 获取单个 Bot 的综合信息（配置 + 运行时状态）
     */
    async getBotInfo(botId) {
        if (!this.configFactory)
            return null;
        try {
            const mgr = this.configFactory.create(ConfigType.BOT, botId);
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
        }
        catch {
            return null;
        }
    }
    /**
     * 获取所有 Bot 的综合信息列表
     */
    async getAllBotsInfo() {
        if (!this.configFactory)
            return [];
        try {
            const names = await this.configFactory.listAll(ConfigType.BOT);
            const results = [];
            for (const botId of names) {
                const info = await this.getBotInfo(botId);
                if (info)
                    results.push(info);
            }
            return results;
        }
        catch {
            return [];
        }
    }
}
