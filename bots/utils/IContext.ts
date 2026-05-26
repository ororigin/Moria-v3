import type { Bot } from 'mineflayer';

export interface IContext {
  bot: Bot | null;
  config: {
    botId: string;
    name: string;
    host: string;
    port: number;
    password: string;
    max_reconnect?: number; // 最大重连次数（优先级）
    maxReconnect?: number; // 驼峰兼容字段
    auto_reconnect?: boolean; // 是否自动重连（snake_case 兼容）
    autoReconnect?: boolean; // 是否自动重连（camelCase）
    reconnect_interval?: number; // 重连间隔，单位毫秒（snake_case）
    reconnectInterval?: number; // 重连间隔，单位毫秒（camelCase）
  };
  getBot() : Bot;
}