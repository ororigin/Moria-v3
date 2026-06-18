import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
import type { BotConfig } from "../types/BotConfig.js";

/**
 * Bot 配置模板
 * 首次读取/写入时，以此模板作为初始值
 * name 参数用于设置 botId 默认值
 */
export class BotConfigTemplate implements IConfigTemplate<BotConfig> {
  getSubDir(): string {
    return "bot";
  }

  getDefault(name: string): BotConfig {
    const now = new Date().toISOString();
    return {
      // 属性
      botId: name,
      name: `Bot-${name}`,
      host: "localhost",
      server: "localhost",
      port: 25565,
      password: "12345678",

      // 重连
      autoReconnect: true,
      maxReconnect: 5,
      reconnectInterval: 5000,

      // 配置
      commandPrefix: "#",

      // 时间戳 
      createdAt: now,
      updatedAt: now,
    };
  }
}
