import type { IConfig } from "../interfaces/IConfig.js";

/**
 * 系统配置数据结构
 * 对应文件：CONFIG_DIR/system/<name>_config.json
 */
export interface SystemConfig extends IConfig {
  version: string;
  logLevel: "debug" | "info" | "warn" | "error";
  maxConnections: number;
  maintenanceMode: boolean;
  allowedOrigins: string[];
}
