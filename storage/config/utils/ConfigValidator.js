import { SCHEMA_MAP } from "./ConfigSchemas.js";
// ─── 验证主函数 ──────────────────────────────────────────────────────────────
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
export function validateConfig(type, jsonString, options) {
    const mode = options?.mode ?? "partial";
    const allowUnknown = options?.allowUnknown ?? false;
    // ── Step 1: 解析 JSON ──────────────────────────────────────────────────
    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    }
    catch (err) {
        return {
            success: false,
            errors: [`JSON 语法错误: ${err.message}`],
            data: null,
            configType: type,
            mode,
        };
    }
    // ── Step 2: 查找 Schema ────────────────────────────────────────────────
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
    // ── Step 3: 按模式调整 Schema ──────────────────────────────────────────
    let schema = schemaFactory();
    if (mode === "partial") {
        // 子集模式：所有字段可选，但类型仍须匹配
        schema = schema.partial();
    }
    // 未知字段处理
    schema = allowUnknown ? schema.passthrough() : schema.strict();
    // ── Step 4: 执行验证 ───────────────────────────────────────────────────
    const result = schema.safeParse(parsed);
    if (result.success) {
        return {
            success: true,
            errors: [],
            data: result.data,
            configType: type,
            mode,
        };
    }
    // ── Step 5: 格式化错误信息 ─────────────────────────────────────────────
    const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
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
