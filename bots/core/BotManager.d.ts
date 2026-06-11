import type { IContext } from '../utils/IContext.js';
import type { CommandDispatcher } from './CommandDispatcher.js';
export declare class BotManager {
    private config;
    private dispatcher;
    private onWhisper;
    private sendLog;
    private sendStatus;
    private bot;
    private reconnectAttempts;
    private reconnectTimer?;
    private shouldExit;
    private context;
    constructor(config: IContext['config'], dispatcher: CommandDispatcher, // 用于清空队列和中断持久命令
    onWhisper: (username: string, message: string) => void, sendLog?: (msg: string, isError?: boolean) => void, sendStatus?: (status: string) => void);
    start(): Promise<void>;
    private createBot;
    private bindEvents;
    private scheduleReconnect;
    shutdown(): void;
}
//# sourceMappingURL=BotManager.d.ts.map