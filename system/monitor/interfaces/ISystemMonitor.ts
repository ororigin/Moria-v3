import type { ISystemInfo } from './ISystemInfo.js';

/**
 * 系统性能监控器接口
 *
 * 负责后台周期性采集 CPU、内存、网络 I/O 数据，
 * 对外提供线程安全的最新快照读取能力。
 *
 * 对应 v2 (Python) 的 SystemMonitor 类。
 */
export interface ISystemMonitor {
    /** 启动后台采集循环（幂等，已运行时忽略） */
    start(): void;

    /** 停止后台采集循环并清理资源（幂等） */
    stop(): void;

    /** 获取最新系统性能快照（线程安全） */
    getInfo(): ISystemInfo;

    /**
     * 获取格式化后的系统性能信息
     * timestamp 转为 ISO 8601 字符串
     */
    getFormattedInfo(): Record<string, string | number>;

    /** 获取监控器当前运行状态 */
    getStatus(): {
        running: boolean;
        updateInterval: number;
        lastUpdate: number | null;
    };
}
