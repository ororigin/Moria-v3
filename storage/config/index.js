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
// ─── 配置模板 ────────────────────────────────────────────────────────────────
export { BotConfigTemplate } from "./templates/BotConfigTemplate.js";
export { SystemConfigTemplate } from "./templates/SystemConfigTemplate.js";
// ─── 管理器 ──────────────────────────────────────────────────────────────────
export { FileConfigManager } from "./managers/FileConfigManager.js";
// ─── 工厂 ────────────────────────────────────────────────────────────────────
export { ConfigManagerFactory } from "./factory/ConfigManagerFactory.js";
export { ConfigType } from "./factory/ConfigType.js";
