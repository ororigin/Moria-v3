import * as mineflayer from 'mineflayer';
export class BotManager {
    config;
    dispatcher;
    onWhisper;
    sendLog;
    sendStatus;
    bot = null;
    reconnectAttempts = 0;
    reconnectTimer;
    shouldExit = false;
    context;
    constructor(config, dispatcher, // 用于清空队列和中断持久命令
    onWhisper, sendLog = () => { }, sendStatus = () => { }) {
        this.config = config;
        this.dispatcher = dispatcher;
        this.onWhisper = onWhisper;
        this.sendLog = sendLog;
        this.sendStatus = sendStatus;
        this.context = { bot: null, config, getBot() {
                if (!this.bot)
                    throw new Error('Context not fully initialized');
                return this.bot;
            }, };
    }
    async start() {
        this.createBot();
    }
    createBot() {
        try {
            const bot = mineflayer.createBot({
                host: this.config.host,
                port: this.config.port,
                username: this.config.name,
                hideErrors: false,
            });
            this.bot = bot;
            this.context.bot = bot;
            this.bindEvents(bot);
        }
        catch (err) {
            this.scheduleReconnect();
        }
    }
    bindEvents(bot) {
        bot.on('spawn', () => {
            this.reconnectAttempts = 0;
            this.sendStatus('online');
        });
        bot.on('end', (reason) => {
            this.sendLog(`断开连接: ${reason}`);
            this.sendStatus('offline');
            this.dispatcher.abortAllAndClear();
            if (!this.shouldExit)
                this.scheduleReconnect();
            else
                process.exit(0);
        });
        bot.on('kicked', (reason) => {
            this.sendLog(`被踢出: ${reason}`, true);
            this.sendStatus('offline');
            this.dispatcher.abortAllAndClear();
            if (!this.shouldExit)
                this.scheduleReconnect();
            else
                process.exit(0);
        });
        bot.on('error', (err) => {
            this.sendLog(`错误: ${err.message}`, true);
            this.sendStatus('offline');
            process.exit(0);
        });
        bot.on('whisper', (username, message) => {
            setImmediate(() => this.onWhisper(username, message));
        });
        // 自动注册/登录的消息监听.
        bot.on('messagestr', (message) => {
            if (message.includes('/reg') && message.includes('注册')) {
                bot.chat(`/reg ${this.config.password} ${this.config.password}@outlook.com`);
            }
            if (message.includes('/l') || message.includes('登录')) {
                bot.chat(`/l ${this.config.password}`);
            }
        });
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        const auto = typeof this.config.auto_reconnect === 'boolean'
            ? this.config.auto_reconnect
            : typeof this.config.autoReconnect === 'boolean'
                ? this.config.autoReconnect
                : true;
        if (!auto) {
            this.sendLog('自动重连已被禁用，进程退出');
            this.shutdown();
            return;
        }
        const max = typeof this.config.max_reconnect === 'number'
            ? this.config.max_reconnect
            : typeof this.config.maxReconnect === 'number'
                ? this.config.maxReconnect
                : 5;
        const interval = typeof this.config.reconnect_interval === 'number'
            ? this.config.reconnect_interval
            : typeof this.config.reconnectInterval === 'number'
                ? this.config.reconnectInterval
                : 5000;
        if (this.reconnectAttempts >= max) {
            this.sendLog(`达到最大重连次数 (${this.reconnectAttempts}/${max})，退出进程`);
            this.shutdown();
            return;
        }
        this.reconnectAttempts++;
        this.sendLog(`将在${interval / 1000}秒后重连 (${this.reconnectAttempts}/${max})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.createBot();
        }, interval);
    }
    // 特权操作：立即退出
    shutdown() {
        this.shouldExit = true;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        if (this.bot)
            this.bot.quit();
        else
            process.exit(0);
    }
}
//# sourceMappingURL=BotManager.js.map