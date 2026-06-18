/**
 * Bot 运行时状态枚举
 *
 * 仅存储在内存（BotProcessEntry）中，不写入配置文件。
 * 主进程重启后所有状态重置为 OFFLINE。
 *
 * 映射关系（子进程 → 主进程）：
 *   'starting' → STARTING
 *   'online'   → ONLINE
 *   'offline'  → OFFLINE
 *   心跳超时   → ERROR（由心跳超时检测逻辑设置）
 */
export enum BotStatus {
    OFFLINE = '离线',
    STARTING = '启动中',
    ONLINE = '在线',
    ERROR = '错误',
}
