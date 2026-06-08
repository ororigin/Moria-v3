import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
import type { SystemConfig } from "../types/SystemConfig.js";

/**
 * 系统配置模板
 * 首次读取/写入时，以此模板作为初始值
 */
export class SystemConfigTemplate implements IConfigTemplate<SystemConfig> {
  getSubDir(): string {
    return "system";
  }

  getDefault(name: string): SystemConfig {
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
