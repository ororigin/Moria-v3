import type { IConfigTemplate } from "../interfaces/IConfigTemplate.js";
import type { BotConfig } from "../types/BotConfig.js";
/**
 * Bot 配置模板
 * 首次读取/写入时，以此模板作为初始值
 * name 参数用于设置 botId 默认值
 */
export declare class BotConfigTemplate implements IConfigTemplate<BotConfig> {
    getSubDir(): string;
    getDefault(name: string): BotConfig;
}
//# sourceMappingURL=BotConfigTemplate.d.ts.map