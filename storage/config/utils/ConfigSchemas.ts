import { z } from 'zod';
import { ConfigType } from '../factory/ConfigType.js';

/** ISO 8601 时间戳（如 "2026-06-17T12:00:00.000Z"） */
const timestampSchema = z.string().datetime();

// 假人
export const botConfigSchema = z.object({
    // 属性
    botId: z.string().uuid('botId 必须是有效的 UUID'),
    name: z.string().min(1, 'name 不能为空'),
    host: z.string().min(1, 'host 不能为空'),
    server: z.string().min(1, 'server 不能为空'),
    port: z
        .number()
        .int('port 必须是整数')
        .min(1, 'port 最小值为 1')
        .max(65535, 'port 最大值为 65535'),
    password: z.string(),

    // 重连
    autoReconnect: z.boolean(),
    maxReconnect: z.number().int('maxReconnect 必须是整数').min(0, 'maxReconnect 不能为负'),
    reconnectInterval: z
        .number()
        .int('reconnectInterval 必须是整数')
        .min(0, 'reconnectInterval 不能为负'),

    // 配置
    commandPrefix: z.string(),

    // 时间戳
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
});

// 系统

export const systemConfigSchema = z.object({
    version: z.string().min(1, 'version 不能为空'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error'], {
        message: 'logLevel 必须是 debug | info | warn | error',
    }),
    maxConnections: z.number().int('maxConnections 必须是整数').min(0, 'maxConnections 不能为负'),
    maintenanceMode: z.boolean(),
    allowedOrigins: z.array(z.string(), 'allowedOrigins 必须是字符串数组'),
    port: z.number().int('port 必须是整数').min(1).max(65535),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
});

// Schema 注册表

export const SCHEMA_MAP: Record<ConfigType, () => z.ZodObject<any>> = {
    [ConfigType.SYSTEM]: () => systemConfigSchema,
    [ConfigType.BOT]: () => botConfigSchema,
};
