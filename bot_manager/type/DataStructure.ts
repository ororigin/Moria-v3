import type { ChildProcess } from 'child_process';
import type { BotStatus } from '../../storage/config/types/BotStatus.js';
import type { BotConfig } from '../../storage/config/types/BotConfig.js';

/** 子进程管理条目（运行时状态，不持久化） */
export interface BotProcessEntry {
    process: ChildProcess;
    pid: number; // 创建时从 child.pid 写入，可被心跳/IPC 确认更新
    status: BotStatus; // 当前运行时状态
    lastHeartbeat: number; // 最后收到心跳的时间戳
    startTime: number; // 条目创建（启动）时间戳
    missedHeartbeats: number; // 连续失跳次数，由心跳监控定时器维护
}

/** createBot 返回结果 */
export interface CreateBotResult {
    botId: string;
    config: BotConfig;
}

/** Bot 信息响应结构（用于 API 输出，不包含 password） */
export interface BotInfoResponse {
    id: string;
    name: string;
    server: string;
    port: number;
    status: string; // BotStatus 的中文值："在线" | "离线" | "启动中" | "错误"
    is_active: boolean; // 进程是否存活
    last_activity: string; // ISO 8601
    created_at: string; // ISO 8601
}
