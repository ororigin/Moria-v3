/**
 * storage/config - 配置管理模块入口
 *
 * 集中导出所有配置相关类型、接口和实现类
 *
 * 使用示例：
 * ```typescript
 * import { ConfigManagerFactory, ConfigType } from "./storage/config/index.js";
 *
 * const factory = new ConfigManagerFactory("./configs");
 * const mgr = factory.create(ConfigType.SYSTEM, "main");
 * const cfg = await mgr.read();
 * ```
 */

// ─── 基础接口 ────────────────────────────────────────────────────────────────
export type { IConfig } from "./interfaces/IConfig.js";
export type { IConfigManager } from "./interfaces/IConfigManager.js";
export type { IConfigTemplate } from "./interfaces/IConfigTemplate.js";
export type { IConfigManagerFactory } from "./interfaces/IConfigManagerFactory.js";

// ─── 配置类型 ────────────────────────────────────────────────────────────────
export type { BotConfig } from "./types/BotConfig.js";
export type { SystemConfig } from "./types/SystemConfig.js";

// ─── 配置模板 ────────────────────────────────────────────────────────────────
export { BotConfigTemplate } from "./templates/BotConfigTemplate.js";
export { SystemConfigTemplate } from "./templates/SystemConfigTemplate.js";

// ─── 管理器 ──────────────────────────────────────────────────────────────────
export { FileConfigManager } from "./managers/FileConfigManager.js";

// ─── 工厂 ────────────────────────────────────────────────────────────────────
export { ConfigManagerFactory } from "./factory/ConfigManagerFactory.js";
export { ConfigType } from "./factory/ConfigType.js";
