import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
import type { SystemConfig } from "../types/SystemConfig.js";
/**
 * 系统配置模板
 * 首次读取/写入时，以此模板作为初始值
 */
export declare class SystemConfigTemplate implements IConfigTemplate<SystemConfig> {
    getSubDir(): string;
    getDefault(name: string): SystemConfig;
}
//# sourceMappingURL=SystemConfigTemplate.d.ts.map