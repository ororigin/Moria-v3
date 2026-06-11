/**
 * 系统配置模板
 * 首次读取/写入时，以此模板作为初始值
 */
export class SystemConfigTemplate {
    getSubDir() {
        return "system";
    }
    getDefault(name) {
        const now = new Date().toISOString();
        return {
            version: "1.0.0",
            logLevel: "info",
            maxConnections: 100,
            maintenanceMode: false,
            allowedOrigins: ["http://localhost:3000"],
            createdAt: now,
            updatedAt: now,
        };
    }
}
