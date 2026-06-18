import type { IConfig } from './IConfig.js';

/**
 * 配置模板接口
 * 每种配置类型必须实现此接口，用于：
 *  - 提供默认值（首次读取时自动写入）
 *  - 声明该类型配置存放的子目录
 */
export interface IConfigTemplate<T extends IConfig> {
    /** 返回该类型配置的默认值（模板） */
    getDefault(name: string): T;

    /** 返回存放该类型配置的子目录名，如 "system" / "bot" */
    getSubDir(): string;
}
