import { z } from "zod";
import { ConfigType } from "../factory/ConfigType.js";

// ─── 时间戳格式 ──────────────────────────────────────────────────────────────

/** ISO 8601 时间戳（如 "2026-06-17T12:00:00.000Z"） */
const timestampSchema = z.string().datetime();

// ─── BotConfig Schema ────────────────────────────────────────────────────────

export const botConfigSchema = z.object({
  // ─── Identifiers ───
  botId: z.string().uuid("botId 必须是有效的 UUID"),
  name: z.string().min(1, "name 不能为空"),
  host: z.string().min(1, "host 不能为空"),
  server: z.string().min(1, "server 不能为空"),
  port: z.number().int("port 必须是整数").min(1, "port 最小值为 1").max(65535, "port 最大值为 65535"),
  password: z.string(),

  // ─── Reconnection Strategy ───
  autoReconnect: z.boolean(),
  maxReconnect: z.number().int("maxReconnect 必须是整数").min(0, "maxReconnect 不能为负"),
  reconnectInterval: z.number().int("reconnectInterval 必须是整数").min(0, "reconnectInterval 不能为负"),

  // ─── General Bot Info ───
  displayName: z.string(),
  token: z.string(),
  commandPrefix: z.string(),
  enabled: z.boolean(),
  maxRetries: z.number().int("maxRetries 必须是整数").min(0, "maxRetries 不能为负"),
  permissions: z.array(z.string(), "permissions 必须是字符串数组"),
  webhookUrl: z.string().nullable(),

  // ─── Timestamps ───
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── SystemConfig Schema ─────────────────────────────────────────────────────

export const systemConfigSchema = z.object({
  version: z.string().min(1, "version 不能为空"),
  logLevel: z.enum(["debug", "info", "warn", "error"], {
    message: "logLevel 必须是 debug | info | warn | error",
  }),
  maxConnections: z.number().int("maxConnections 必须是整数").min(0, "maxConnections 不能为负"),
  maintenanceMode: z.boolean(),
  allowedOrigins: z.array(z.string(), "allowedOrigins 必须是字符串数组"),

  // ─── Timestamps ───
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Schema 注册表 ───────────────────────────────────────────────────────────
// 与 ConfigManagerFactory.TEMPLATE_MAP 保持一致的注册模式

export const SCHEMA_MAP: Record<ConfigType, () => z.ZodObject<any>> = {
  [ConfigType.SYSTEM]: () => systemConfigSchema,
  [ConfigType.BOT]: () => botConfigSchema,
};
