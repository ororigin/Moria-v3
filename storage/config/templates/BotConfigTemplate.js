/**
 * Bot 配置模板
 * 首次读取/写入时，以此模板作为初始值
 * name 参数用于设置 botId 默认值
 */
export class BotConfigTemplate {
    getSubDir() {
        return "bot";
    }
    getDefault(name) {
        const now = new Date().toISOString();
        return {
            // ─── 标识 ───────────────────────────────────────────────────────────
            botId: name,
            name: `Bot-${name}`,
            host: "localhost",
            server: "localhost",
            port: 25565,
            password: "ufdbfcir",
            // ─── 重连策略 ───────────────────────────────────────────────────────
            autoReconnect: true,
            maxReconnect: 5,
            reconnectInterval: 5000,
            // ─── 通用 Bot 信息 ──────────────────────────────────────────────────
            displayName: `Bot-${name}`,
            token: "",
            commandPrefix: "!",
            enabled: true,
            maxRetries: 3,
            permissions: ["read", "write"],
            webhookUrl: null,
            // ─── 时间戳 ─────────────────────────────────────────────────────────
            createdAt: now,
            updatedAt: now,
        };
    }
}
