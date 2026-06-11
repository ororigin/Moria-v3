import type { IConfig } from "./IConfig.js";
/**
 * 配置管理器接口
 * 针对「某一个」具体配置文件的增删查改
 */
export interface IConfigManager<T extends IConfig> {
    /** 读取配置；若文件不存在则按模板创建后返回 */
    read(): Promise<T>;
    /** 写入配置（深度合并），自动更新 updatedAt，返回最终配置 */
    write(patch: Partial<Omit<T, "createdAt" | "updatedAt">>): Promise<T>;
    /** 删除配置文件 */
    delete(): Promise<void>;
    /** 判断配置文件是否存在 */
    exists(): Promise<boolean>;
    /** 返回配置文件的完整路径 */
    getFilePath(): string;
}
//# sourceMappingURL=IConfigManager.d.ts.map