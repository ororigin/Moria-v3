import type { IConfig } from '../interfaces/IConfig.js';

/**
 * Bot 配置数据结构
 * 对应文件：CONFIG_DIR/bot/<name>_config.json
 *
 * 包含：
 *  - 运行时连接参数（host / port / password）
 *  - 重连策略（autoReconnect / maxReconnect / reconnectInterval）
 *  - 通用 Bot 元信息（displayName / token / commandPrefix 等）
 */
export interface BotConfig extends IConfig {
    /** Bot 唯一标识（UUID） */
    botId: string;
    /** Minecraft 用户名 */
    name: string;
    /** 服务器地址 */
    host: string;
    /** 服务器地址别名（兼容旧版 API 字段名） */
    server: string;
    /** 服务器端口 */
    port: number;
    /** 服务器密码 */
    password: string;

    // ─── 重连策略 ────────────────────────────────────────────────────────────
    /** 是否启用自动重连 */
    autoReconnect: boolean;
    /** 最大重连次数 */
    maxReconnect: number;
    /** 重连间隔（毫秒） */
    reconnectInterval: number;

    // ─── 通用配置 ─────────────────────────────────────────────────────────────
    /** 命令前缀 */
    commandPrefix: string;
}
