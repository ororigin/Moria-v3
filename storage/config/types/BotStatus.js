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
export var BotStatus;
(function (BotStatus) {
    BotStatus["OFFLINE"] = "\u79BB\u7EBF";
    BotStatus["STARTING"] = "\u542F\u52A8\u4E2D";
    BotStatus["ONLINE"] = "\u5728\u7EBF";
    BotStatus["ERROR"] = "\u9519\u8BEF";
})(BotStatus || (BotStatus = {}));
