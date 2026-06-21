import * as mineflayer from "mineflayer";
import type { IContext } from "../utils/IContext.js";
import type { CommandDispatcher } from "./CommandDispatcher.js";

export class BotManager {
    private bot: mineflayer.Bot | null = null;
    private reconnectAttempts = 0;
    private reconnectTimer?: NodeJS.Timeout | null;
    private shouldExit = false;
    private context: IContext;
    /** 外部上下文（bot.ts 中的本地 context），用于同步 bot 实例 */
    private externalContext: IContext | null = null;

    constructor(
        private config: IContext["config"],
        private dispatcher: CommandDispatcher, // 用于清空队列和中断持久命令
        private onWhisper: (username: string, message: string) => void,
        private sendLog: (msg: string, isError?: boolean) => void = () => {},
        private sendStatus: (status: string) => void = () => {},
        private onChat: (message: string) => void = () => {},
        externalContext?: IContext,
    ) {
        this.externalContext = externalContext ?? null;
        this.context = {
            bot: null,
            config,
            getBot() {
                if (!this.bot) throw new Error("Context not fully initialized");
                return this.bot;
            },
        };
    }

    async start(): Promise<void> {
        this.createBot();
    }

    private createBot(): void {
        try {
            const bot = mineflayer.createBot({
                host: this.config.host,
                port: this.config.port,
                username: this.config.name,
                hideErrors: false,
            });
            this.bot = bot;
            this.context.bot = bot;
            if (this.externalContext) {
                this.externalContext.bot = bot;
            }
            this.bindEvents(bot);
        } catch (err) {
            this.scheduleReconnect();
        }
    }

    private bindEvents(bot: mineflayer.Bot): void {
        bot.on("spawn", () => {
            this.reconnectAttempts = 0;
            this.sendStatus("online");
        });

        bot.on("end", (reason) => {
            this.sendLog(`断开连接: ${reason}`);
            this.sendStatus("offline");
            this.dispatcher.abortAllAndClear();
            if (!this.shouldExit) this.scheduleReconnect();
            else process.exit(0);
        });

        bot.on("kicked", (reason) => {
            this.sendLog(`被踢出: ${reason}`, true);
            this.sendStatus("offline");
            this.dispatcher.abortAllAndClear();
            if (!this.shouldExit) this.scheduleReconnect();
            else process.exit(0);
        });

        bot.on("error", (err) => {
            this.sendLog(`错误: ${err.message}`, true);
            this.sendStatus("offline");
            process.exit(0);
        });

        bot.on("whisper", (username, message) => {
            setImmediate(() => this.onWhisper(username, message));
        });

        // 自动注册/登录 + 上报聊天消息到主进程
        bot.on("messagestr", (message) => {
            if (message.includes("/reg") && message.includes("注册")) {
                bot.chat(
                    `/reg ${this.config.password} ${this.config.password}@outlook.com`,
                );
            }
            if (message.includes("/l") || message.includes("登录")) {
                bot.chat(`/l ${this.config.password}`);
            }
            // 将聊天信息上报到主进程
            this.onChat(message);
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;

        const { autoReconnect, maxReconnect, reconnectInterval } = this.config;

        if (!autoReconnect) {
            this.sendLog("自动重连已被禁用，进程退出");
            this.shutdown();
            return;
        }

        if (this.reconnectAttempts >= maxReconnect) {
            this.sendLog(
                `达到最大重连次数 (${this.reconnectAttempts}/${maxReconnect})，退出进程`,
            );
            this.shutdown();
            return;
        }
        this.reconnectAttempts++;
        this.sendLog(
            `将在${reconnectInterval / 1000}秒后重连 (${this.reconnectAttempts}/${maxReconnect})`,
        );
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.createBot();
        }, reconnectInterval);
    }

    // 特权操作：立即退出
    shutdown(): void {
        this.shouldExit = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.bot) this.bot.quit();
        else process.exit(0);
    }

    // sendLog 和 sendStatus 通过构造函数注入，由 bot.ts 提供 transport 输出实现
}
