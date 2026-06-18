/**
 * 系统性能快照数据结构
 *
 * 对应 v2 (Python) 的 SystemInfo 数据类，
 * 表示某一时刻的 CPU、内存、网络 I/O 状态。
 */
export interface ISystemInfo {
    /** CPU 使用率（百分比，0–100） */
    cpuPercent: number;

    /** 内存使用率（百分比，0–100） */
    memoryPercent: number;

    /** 上行速率（bps，比特/秒） */
    uploadRateBps: number;

    /** 下行速率（bps，比特/秒） */
    downloadRateBps: number;

    /** 采样时间戳（Unix 毫秒） */
    timestamp: number;
}
