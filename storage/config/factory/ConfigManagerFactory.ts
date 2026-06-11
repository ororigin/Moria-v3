import fs from "fs/promises";
import path from "path";
import type { IConfig } from "../interfaces/IConfig.js";
import type { IConfigManager } from "../interfaces/IConfigManager.js";
import type { IConfigManagerFactory } from "../interfaces/IConfigManagerFactory.js";
import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
import { FileConfigManager } from "../managers/FileConfigManager.js";
import { SystemConfigTemplate } from "../templates/SystemConfigTemplate.js";
import { BotConfigTemplate } from "../templates/BotConfigTemplate.js";
import { ConfigType } from "./ConfigType.js";

/**
 * 配置管理器工厂
 *
 * 用法：
 *   const factory = new ConfigManagerFactory("/data/configs");
 *   const mgr = factory.create<SystemConfig>(ConfigType.SYSTEM, "main");
 *   const cfg = await mgr.read();
 *
 * 生成路径：
 *   /data/configs/system/main_config.json
 *   /data/configs/bot/uuid1_config.json
 */
export class ConfigManagerFactory implements IConfigManagerFactory {
  /**
   * 模板注册表
   * 扩展新类型只需在此处添加一行
   */
  private static readonly TEMPLATE_MAP: Record<
    ConfigType,
    () => IConfigTemplate<IConfig>
  > = {
    [ConfigType.SYSTEM]: () => new SystemConfigTemplate(),
    [ConfigType.BOT]: () => new BotConfigTemplate(),
  };

  constructor(private readonly configDir: string) {}

  // ─── IConfigManagerFactory ─────────────────────────────────────────────────

  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * 列出指定类型的所有配置名称
   *
   * @param type  配置类型
   * @returns 配置名称数组（不含 _config.json 后缀）
   */
  async listAll(type: string): Promise<string[]> {
    const subDir = this.resolveSubDir(type);
    const dirPath = path.join(this.configDir, subDir);

    try {
      const files = await fs.readdir(dirPath);
      const suffix = "_config.json";

      return files
        .filter((f) => f.endsWith(suffix))
        .map((f) => f.slice(0, -suffix.length));
    } catch {
      // 目录不存在时返回空数组
      return [];
    }
  }

  /**
   * 创建指定类型+名称的配置管理器
   *
   * @param type  配置类型，见 ConfigType
   * @param name  配置名称，如 "main" / "uuid1"（会成为文件名前缀）
   */
  create<T extends IConfig>(
    type: ConfigType,
    name: string
  ): IConfigManager<T> {
    const templateFactory = ConfigManagerFactory.TEMPLATE_MAP[type];
    if (!templateFactory) {
      throw new Error(`[ConfigManagerFactory] Unknown config type: "${type}"`);
    }
    const template = templateFactory() as IConfigTemplate<T>;
    return new FileConfigManager<T>(this.configDir, name, template);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * 根据配置类型获取子目录名
   */
  private resolveSubDir(type: string): string {
    const found = Object.values(ConfigType).find((v) => v === type);
    return found ?? type;
  }
}
