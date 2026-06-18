import type { IConfig } from './IConfig.js';
import type { IConfigManager } from './IConfigManager.js';

/**
 * 配置管理器工厂接口
 * 根据配置类型和名称创建对应的 IConfigManager 实例
 */
export interface IConfigManagerFactory {
    /**
     * 创建指定类型+名称的配置管理器
     *
     * @param type  配置类型
     * @param name  配置名称（会成为文件名前缀）
     */
    create<T extends IConfig>(type: string, name: string): IConfigManager<T>;

    /**
     * 列出指定类型的所有配置名称
     *
     * @param type  配置类型
     * @returns 配置名称数组（不含 _config.json 后缀）
     */
    listAll(type: string): Promise<string[]>;

    /**
     * 返回工厂所管理的配置根目录
     */
    getConfigDir(): string;
}
