import type { IConfig } from "../interfaces/IConfig.js";
import type { IConfigManager } from "../interfaces/IConfigManager.js";
import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
/**
 * 基于 JSON 文件的通用配置管理器
 *
 * 文件命名规则：<configDir>/<subDir>/<name>_config.json
 *
 * - read()  : 文件存在 → 直接读取；不存在 → 按模板生成并写入后返回
 * - write() : 深度合并 patch → 更新 updatedAt → 写入文件
 */
export declare class FileConfigManager<T extends IConfig> implements IConfigManager<T> {
    private readonly configDir;
    private readonly name;
    private readonly template;
    private readonly filePath;
    constructor(configDir: string, name: string, template: IConfigTemplate<T>);
    getFilePath(): string;
    exists(): Promise<boolean>;
    read(): Promise<T>;
    write(patch: Partial<Omit<T, "createdAt" | "updatedAt">>): Promise<T>;
    delete(): Promise<void>;
    /** 确保目录存在后写入 JSON */
    private persist;
    /**
     * 配置校验钩子
     * 子类可重写此方法以实现自定义校验逻辑
     *
     * @throws 当配置不合法时抛出 Error
     */
    protected validateConfig(_config: T): void;
}
//# sourceMappingURL=FileConfigManager.d.ts.map