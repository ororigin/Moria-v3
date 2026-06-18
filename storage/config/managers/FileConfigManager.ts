import fs from 'fs/promises';
import path from 'path';
import type { IConfig } from '../interfaces/IConfig.js';
import type { IConfigManager } from '../interfaces/IConfigManager.js';
import type { IConfigTemplate } from '../interfaces/IConfigTemplate.js';

/**
 * 基于 JSON 文件的通用配置管理器
 *
 * 文件命名规则：<configDir>/<subDir>/<name>_config.json
 *
 * - read()  : 文件存在 → 直接读取；不存在 → 按模板生成并写入后返回
 * - write() : 深度合并 patch → 更新 updatedAt → 写入文件
 */
export class FileConfigManager<T extends IConfig> implements IConfigManager<T> {
    private readonly filePath: string;

    constructor(
        private readonly configDir: string,
        private readonly name: string,
        private readonly template: IConfigTemplate<T>,
    ) {
        this.filePath = path.join(configDir, template.getSubDir(), `${name}_config.json`);
    }

    // IConfigManager 接口实现

    getFilePath(): string {
        return this.filePath;
    }

    async exists(): Promise<boolean> {
        try {
            await fs.access(this.filePath);
            return true;
        } catch {
            return false;
        }
    }

    async read(): Promise<T> {
        if (await this.exists()) {
            try {
                const raw = await fs.readFile(this.filePath, 'utf-8');
                const parsed = JSON.parse(raw) as T;
                this.validateConfig(parsed);
                return parsed;
            } catch (err) {
                if (err instanceof SyntaxError) {
                    throw new Error(
                        `[FileConfigManager] 配置文件语法错误，请检查文件格式: ${this.filePath}\n  ${err.message}`,
                    );
                }
                throw err;
            }
        }
        // 首次读取：按模板生成默认配置并持久化
        const defaults = this.template.getDefault(this.name);
        await this.persist(defaults);
        return defaults;
    }

    async write(patch: Partial<Omit<T, 'createdAt' | 'updatedAt'>>): Promise<T> {
        const current = await this.read();
        const updated: T = {
            ...deepMerge(current, patch as Partial<T>),
            updatedAt: new Date().toISOString(),
        };
        this.validateConfig(updated);
        await this.persist(updated);
        return updated;
    }

    async delete(): Promise<void> {
        if (await this.exists()) {
            await fs.unlink(this.filePath);
        }
    }

    // Helpers

    /** 确保目录存在后写入 JSON */
    private async persist(data: T): Promise<void> {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    /**
     * 配置校验钩子
     * 子类可重写此方法以实现自定义校验逻辑
     *
     * @throws 当配置不合法时抛出 Error
     */
    protected validateConfig(_config: T): void {
        // 默认不做校验，子类可覆盖
    }
}

// Deep Merge

/**
 * 简单深度合并：plain object 递归合并，其他类型直接覆盖
 */
function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
    const result = { ...base };
    for (const key of Object.keys(patch) as (keyof T)[]) {
        const baseVal = result[key];
        const patchVal = patch[key];
        if (isPlainObject(baseVal) && isPlainObject(patchVal)) {
            result[key] = deepMerge(baseVal as object, patchVal as object) as T[keyof T];
        } else if (patchVal !== undefined) {
            result[key] = patchVal as T[keyof T];
        }
    }
    return result;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}
