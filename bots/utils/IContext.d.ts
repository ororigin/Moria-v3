import type { Bot } from 'mineflayer';
export interface IContext {
    bot: Bot | null;
    config: {
        botId: string;
        name: string;
        host: string;
        port: number;
        password: string;
        max_reconnect?: number;
        maxReconnect?: number;
        auto_reconnect?: boolean;
        autoReconnect?: boolean;
        reconnect_interval?: number;
        reconnectInterval?: number;
    };
    getBot(): Bot;
}
//# sourceMappingURL=IContext.d.ts.map