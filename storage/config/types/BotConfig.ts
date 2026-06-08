import type { IConfig } from "../interfaces/IConfig.js";

/**
 * Bot 配置数据结构
 * 对应文件：CONFIG_DIR/bot/<name>_config.json
 */
export interface BotConfig extends IConfig {
  botId: string;
  displayName: string;
  token: string;
  commandPrefix: string;
  enabled: boolean;
  maxRetries: number;
  permissions: string[];
  webhookUrl: string | null;
}
