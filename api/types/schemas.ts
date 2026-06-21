import { z } from 'zod';

// 请求体验证 Schema

/** POST /api/bots 请求体验证 */
export const createBotSchema = z.object({
    name: z.string().min(1, 'name 为必填的 Minecraft 用户名'),
    server: z.string().min(1, 'server 为必填的服务器地址'),
    port: z
        .number()
        .int('port 必须是整数')
        .min(1, 'port 必须在 1–65535 之间')
        .max(65535, 'port 必须在 1–65535 之间'),
    password: z.string().optional(),
});

/** POST /api/bots/:id/command 请求体验证 */
export const sendCommandSchema = z.object({
    command: z.string().min(1, 'command 为必填的聊天命令'),
});

/** POST /api/bots/:id/action 请求体验证 */
export const executeActionSchema = z.object({
    action: z.string().min(1, 'action 为必填的动作名称'),
    params: z.record(z.string(), z.any()).optional(),
});

/** GET /api/bots/:id/logs|chats 查询参数验证 */
export const linesQuerySchema = z.object({
    lines: z.coerce.number().int().min(1).max(1000).optional().default(50),
});

// Fastify JSON Schema

/** createBotSchema 的 JSON Schema 版本（Fastify schema.body 用） */
export const createBotJSONSchema = z.toJSONSchema(createBotSchema, { target: 'draft-07' });

/** sendCommandSchema 的 JSON Schema 版本 */
export const sendCommandJSONSchema = z.toJSONSchema(sendCommandSchema, { target: 'draft-07' });

/** executeActionSchema 的 JSON Schema 版本 */
export const executeActionJSONSchema = z.toJSONSchema(executeActionSchema, { target: 'draft-07' });

// 推导类型

/** PATCH /api/bots/:id/config 请求体验证（部分更新，不包含不可变字段） */
export const updateBotConfigSchema = z.object({
    name: z.string().min(1, 'name 不能为空').optional(),
    host: z.string().min(1, 'host 不能为空').optional(),
    server: z.string().min(1, 'server 不能为空').optional(),
    port: z
        .number()
        .int('port 必须是整数')
        .min(1, 'port 最小值为 1')
        .max(65535, 'port 最大值为 65535')
        .optional(),
    password: z.string().optional(),
    autoReconnect: z.boolean().optional(),
    maxReconnect: z
        .number()
        .int('maxReconnect 必须是整数')
        .min(0, 'maxReconnect 不能为负')
        .optional(),
    reconnectInterval: z
        .number()
        .int('reconnectInterval 必须是整数')
        .min(0, 'reconnectInterval 不能为负')
        .optional(),
    commandPrefix: z.string().optional(),
});

/** updateBotConfigSchema 的 JSON Schema 版本 */
export const updateBotConfigJSONSchema = z.toJSONSchema(updateBotConfigSchema, { target: 'draft-07' });

// 推导类型

export type CreateBotInput = z.input<typeof createBotSchema>;
export type SendCommandInput = z.input<typeof sendCommandSchema>;
export type ExecuteActionInput = z.input<typeof executeActionSchema>;
export type LinesQueryInput = z.output<typeof linesQuerySchema>;
export type UpdateBotConfigInput = z.input<typeof updateBotConfigSchema>;
