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
            botId: name,
            displayName: `Bot-${name}`,
            token: "",
            commandPrefix: "!",
            enabled: true,
            maxRetries: 3,
            permissions: ["read", "write"],
            webhookUrl: null,
            createdAt: now,
            updatedAt: now,
        };
    }
}
//# sourceMappingURL=BotConfigTemplate.js.map