import type { Bot } from 'mineflayer';

/**
 * Bot 运行时配置
 * 必须与 storage/config/types/BotConfig.ts 保持字段一致
 */
export interface BotRuntimeConfig {
  botId: string;
  name: string;
  host: string;
  server: string;
  port: number;
  password: string;

  // ─── 重连策略 ────────────────────────────────────────────────────────────
  autoReconnect: boolean;
  maxReconnect: number;
  reconnectInterval: number;

  // ─── 通用 Bot 信息 ────────────────────────────────────────────────────────
  displayName: string;
  token: string;
  commandPrefix: string;
  enabled: boolean;
  maxRetries: number;
  permissions: string[];
  webhookUrl: string | null;

  // ─── 时间戳（由配置管理器维护） ──────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
}

export interface IContext {
  bot: Bot | null;
  config: BotRuntimeConfig;
  getBot() : Bot;
}