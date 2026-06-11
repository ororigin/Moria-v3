import type { IConfig } from "../interfaces/IConfig.js";
import type { IConfigManager } from "../interfaces/IConfigManager.js";
import type { IConfigManagerFactory } from "../interfaces/IConfigManagerFactory.js";
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
export declare class ConfigManagerFactory implements IConfigManagerFactory {
    private readonly configDir;
    /**
     * 模板注册表
     * 扩展新类型只需在此处添加一行
     */
    private static readonly TEMPLATE_MAP;
    constructor(configDir: string);
    getConfigDir(): string;
    /**
     * 列出指定类型的所有配置名称
     *
     * @param type  配置类型
     * @returns 配置名称数组（不含 _config.json 后缀）
     */
    listAll(type: string): Promise<string[]>;
    /**
     * 创建指定类型+名称的配置管理器
     *
     * @param type  配置类型，见 ConfigType
     * @param name  配置名称，如 "main" / "uuid1"（会成为文件名前缀）
     */
    create<T extends IConfig>(type: ConfigType, name: string): IConfigManager<T>;
    /**
     * 根据配置类型获取子目录名
     */
    private resolveSubDir;
}
//# sourceMappingURL=ConfigManagerFactory.d.ts.map