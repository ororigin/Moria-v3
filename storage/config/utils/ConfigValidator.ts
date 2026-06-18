import type { ConfigType } from '../factory/ConfigType.js';
import { SCHEMA_MAP } from './ConfigSchemas.js';

// 类型定义

export interface ValidationOptions {
    /**
     * 验证模式
     * - `"partial"`: 只验证 JSON 中存在的字段，允许缺失必填字段（子集检查）
     * - `"strict"`:  要求包含目标配置的所有字段
     * @default "partial"
     */
    mode?: 'partial' | 'strict';

    /**
     * 是否允许目标配置中不存在的未知字段
     * @default false
     */
    allowUnknown?: boolean;
}

export interface ValidationResult<T = unknown> {
    /** 是否通过验证 */
    success: boolean;
    /** 错误信息列表（扁平化） */
    errors: string[];
    /** 验证通过后的数据对象（失败时为 null） */
    data: T | null;
    /** 目标配置类型 */
    configType: ConfigType;
    /** 验证时使用的模式 */
    mode: 'partial' | 'strict';
}

// 验证主函数

/**
 * 验证 JSON 字符串是否为指定配置类型的有效数据
 *
 * @param type        目标配置类型（ConfigType 枚举）
 * @param jsonString  待验证的 JSON 字符串
 * @param options     验证选项
 * @returns           验证结果
 *
 * @example
 * ```typescript
 * const result = validateConfig(ConfigType.BOT, '{"port": 25565}');
 * // { success: true, data: { port: 25565 }, ... }
 *
 * const result = validateConfig(ConfigType.BOT, '{"port": "abc"}');
 * // { success: false, errors: ["[port] 必须为整数"], ... }
 * ```
 */
export function validateConfig<T = unknown>(
    type: ConfigType,
    jsonString: string,
    options?: ValidationOptions,
): ValidationResult<T> {
    const mode = options?.mode ?? 'partial';
    const allowUnknown = options?.allowUnknown ?? false;

    // 解析 JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonString);
    } catch (err) {
        return {
            success: false,
            errors: [`JSON 语法错误: ${(err as Error).message}`],
            data: null,
            configType: type,
            mode,
        };
    }

    // 查找 Schema
    const schemaFactory = SCHEMA_MAP[type];
    if (!schemaFactory) {
        return {
            success: false,
            errors: [`未知的配置类型: "${type}"`],
            data: null,
            configType: type,
            mode,
        };
    }

    // 按模式调整 Schema
    let schema = schemaFactory();

    if (mode === 'partial') {
        // 子集模式：所有字段可选，但类型仍须匹配
        schema = schema.partial();
    }

    // 未知字段处理
    schema = allowUnknown ? schema.passthrough() : schema.strict();

    // 执行验证
    const result = schema.safeParse(parsed);

    if (result.success) {
        return {
            success: true,
            errors: [],
            data: result.data as T,
            configType: type,
            mode,
        };
    }

    // 格式化错误信息
    const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `[${path}] ${issue.message}`;
    });

    return {
        success: false,
        errors,
        data: null,
        configType: type,
        mode,
    };
}
