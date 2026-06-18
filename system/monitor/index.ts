/**
 * system/monitor — 系统性能监控模块
 *
 * 提供后台周期性采集 CPU、内存、网络 I/O 数据的能力。
 */

// 接口
export type { ISystemInfo } from "./interfaces/ISystemInfo.js";
export type { ISystemMonitor } from "./interfaces/ISystemMonitor.js";

// 实现
export { SystemMonitor } from "./SystemMonitor.js";
