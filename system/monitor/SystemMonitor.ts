import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import si from 'systeminformation';
import type { ISystemInfo } from './interfaces/ISystemInfo.js';
import type { ISystemMonitor } from './interfaces/ISystemMonitor.js';
import type ILogger from '../../storage/log/ILogger.js';
import SimpleAsyncMutex from '../../utils/SimpleAsyncMutex.js';

const execFileAsync = promisify(execFile);

/**
 * 系统性能监控器实现
 *
 * 在后台以固定间隔采集 CPU、内存、网络 I/O 数据，
 * 对外提供线程安全的最新快照读取。
 *
 * 对应 v2 (Python) SystemMonitor 的 TypeScript 实现，
 * CPU/内存使用 Node.js 内置 os 模块，网络 I/O 使用 systeminformation 包。
 */
export class SystemMonitor implements ISystemMonitor {
    private _updateInterval: number;

    // 注入的依赖
    private _logger: ILogger | undefined;

    // 运行状态
    private _running = false;
    private _intervalTimer: ReturnType<typeof setInterval> | null = null;

    // 最新快照 & 线程安全
    private _info: ISystemInfo = {
        cpuPercent: 0,
        memoryPercent: 0,
        uploadRateBps: 0,
        downloadRateBps: 0,
        timestamp: Date.now(),
    };
    private _mutex = new SimpleAsyncMutex();

    // CPU 差值计算缓存
    private _prevCpuTimes: { idle: number; total: number } | null = null;

    // 网络 I/O 差值计算缓存
    private _prevNetBytes: { rx: number; tx: number } | null = null;
    private _prevNetTime: number = Date.now();

    /**
     * @param updateInterval  采集间隔（毫秒），默认 2000ms
     * @param logger          可选日志记录器，用于输出采集状态和异常
     */
    constructor(updateInterval: number = 2000, logger?: ILogger) {
        this._updateInterval = updateInterval;
        this._logger = logger ?? undefined;
    }

    // ISystemMonitor 接口实现

    start(): void {
        if (this._running) {
            this._logger?.sysLog('warn', 'SystemMonitor', 'start() 被重复调用，已忽略');
            return;
        }

        this._logger?.sysLog(
            'info',
            'SystemMonitor',
            `启动系统监控（间隔 ${this._updateInterval}ms）`,
        );

        this._running = true;
        this._resetCaches();

        // 立即执行一次首次采集，避免 start() 后需要等待一个 interval
        this._collect().catch((err) => {
            this._logger?.sysLog('error', 'SystemMonitor', `首次采集失败: ${err}`);
        });

        this._intervalTimer = setInterval(() => {
            this._collect().catch((err) => {
                this._logger?.sysLog('error', 'SystemMonitor', `采集循环异常: ${err}`);
            });
        }, this._updateInterval);

        // 不阻止进程退出
        if (
            this._intervalTimer &&
            typeof this._intervalTimer === 'object' &&
            'unref' in this._intervalTimer
        ) {
            this._intervalTimer.unref();
        }

        this._logger?.sysLog('info', 'SystemMonitor', '系统监控已启动');
    }

    stop(): void {
        if (!this._running) {
            this._logger?.sysLog('warn', 'SystemMonitor', 'stop() 被重复调用，已忽略');
            return;
        }

        this._logger?.sysLog('info', 'SystemMonitor', '停止系统监控');

        this._running = false;

        if (this._intervalTimer !== null) {
            clearInterval(this._intervalTimer);
            this._intervalTimer = null;
        }

        this._logger?.sysLog('info', 'SystemMonitor', '系统监控已停止');
    }

    getInfo(): ISystemInfo {
        return this._info;
    }

    getFormattedInfo(): Record<string, string | number> {
        const info = this.getInfo();
        return {
            cpuPercent: info.cpuPercent,
            memoryPercent: info.memoryPercent,
            uploadRateBps: info.uploadRateBps,
            downloadRateBps: info.downloadRateBps,
            timestamp: new Date(info.timestamp).toISOString(),
        };
    }

    getStatus(): { running: boolean; updateInterval: number; lastUpdate: number | null } {
        return {
            running: this._running,
            updateInterval: this._updateInterval,
            lastUpdate: this._info.timestamp,
        };
    }

    // 内部方法

    /**
     * 重置差值计算缓存，使下次采集从头开始计算
     */
    private _resetCaches(): void {
        this._prevCpuTimes = null;
        this._prevNetBytes = null;
        this._prevNetTime = Date.now();
    }

    /**
     * 执行一次完整的采集流程（CPU + 内存 + 网络 I/O）
     */
    private async _collect(): Promise<void> {
        try {
            const cpuPercent = this._calcCpuPercent();
            const memoryPercent = this._calcMemoryPercent();
            const { uploadRateBps, downloadRateBps } = await this._calcNetworkBps();

            const snapshot: ISystemInfo = {
                cpuPercent,
                memoryPercent,
                uploadRateBps,
                downloadRateBps,
                timestamp: Date.now(),
            };

            // 线程安全更新
            await this._mutex.runExclusive(() => {
                this._info = snapshot;
            });

            this._logger?.sysLog(
                'debug',
                'SystemMonitor',
                `CPU: ${cpuPercent.toFixed(1)}%, 内存: ${memoryPercent.toFixed(1)}%, ` +
                    `上行: ${uploadRateBps.toFixed(0)} bps, 下行: ${downloadRateBps.toFixed(0)} bps`,
            );
        } catch (err) {
            this._logger?.sysLog('error', 'SystemMonitor', `采集失败: ${err}`);
        }
    }

    // CPU

    /**
     * 计算 CPU 使用率（百分比）
     *
     * 通过轮询 os.cpus() 计算 idle 与非 idle 时间的差值比，
     * 模拟 psutil.cpu_percent() 的行为。
     *
     * 首次调用时缓存快照并返回 0，后续调用返回真实百分比。
     */
    private _calcCpuPercent(): number {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            const { user, nice, sys, idle, irq } = cpu.times;
            totalTick += user + nice + sys + idle + irq;
            totalIdle += idle;
        }

        if (this._prevCpuTimes === null) {
            // 首次调用：仅缓存，返回 0
            this._prevCpuTimes = { idle: totalIdle, total: totalTick };
            return 0;
        }

        const idleDelta = totalIdle - this._prevCpuTimes.idle;
        const totalDelta = totalTick - this._prevCpuTimes.total;

        // 更新缓存
        this._prevCpuTimes = { idle: totalIdle, total: totalTick };

        if (totalDelta === 0) {
            return 0;
        }

        return Number.parseFloat(((1 - idleDelta / totalDelta) * 100).toFixed(1));
    }

    // ── 内存 ───────────────────────────────────────────────────────

    /**
     * 计算内存使用率（百分比）
     *
     * `(totalmem - freemem) / totalmem × 100`
     */
    private _calcMemoryPercent(): number {
        const total = os.totalmem();
        const free = os.freemem();
        if (total === 0) return 0;
        return Number.parseFloat(((1 - free / total) * 100).toFixed(1));
    }

    // ── 网络 I/O ───────────────────────────────────────────────────

    /**
     * 计算网络 I/O 速率（bps）
     *
     * 使用 systeminformation 的 networkStats() 获取各网卡的累计字节数，
     * 通过差值计算速率：`(bytesDelta / timeDelta) × 8`。
     *
     * 首次调用时缓存计数值并返回 0。
     */
    /**
     * PowerShell 降级方案：获取各网卡累计收发字节数（Windows 专用）
     *
     * systeminformation 在 Windows 上可能无法读取网卡统计，
     * 此方法通过 Get-NetAdapterStatistics 获取真实数据。
     */
    private async _getNetStatsViaPowerShell(): Promise<{ rxTotal: number; txTotal: number }> {
        const { stdout } = await execFileAsync(
            'powershell',
            [
                '-NoProfile',
                '-Command',
                'Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes | ConvertTo-Json -Compress',
            ],
            { timeout: 5000 },
        );
        const adapters: { Name: string; ReceivedBytes: number; SentBytes: number }[] =
            JSON.parse(stdout);
        let rxTotal = 0;
        let txTotal = 0;
        for (const adapter of adapters) {
            rxTotal += adapter.ReceivedBytes ?? 0;
            txTotal += adapter.SentBytes ?? 0;
        }
        return { rxTotal, txTotal };
    }

    private async _calcNetworkBps(): Promise<{
        uploadRateBps: number;
        downloadRateBps: number;
    }> {
        const now = Date.now();

        let rxTotal = 0;
        let txTotal = 0;

        try {
            const netStats = await si.networkStats();
            for (const iface of netStats) {
                rxTotal += iface.rx_bytes;
                txTotal += iface.tx_bytes;
            }

            // systeminformation 返回全零时，试 PowerShell 降级
            if (rxTotal === 0 && txTotal === 0 && process.platform === 'win32') {
                try {
                    const ps = await this._getNetStatsViaPowerShell();
                    rxTotal = ps.rxTotal;
                    txTotal = ps.txTotal;
                } catch (psErr) {
                    this._logger?.sysLog(
                        'warn',
                        'SystemMonitor',
                        `PowerShell 降级也失败: ${psErr}`,
                    );
                }
            }
        } catch (err) {
            this._logger?.sysLog('warn', 'SystemMonitor', `获取网络统计失败: ${err}`);
            // 网络采集失败时，保持上次的速率值不变，不重置缓存
            return {
                uploadRateBps: this._info.uploadRateBps,
                downloadRateBps: this._info.downloadRateBps,
            };
        }

        if (this._prevNetBytes === null) {
            // 首次调用：仅缓存，返回 0
            this._prevNetBytes = { rx: rxTotal, tx: txTotal };
            this._prevNetTime = now;
            return { uploadRateBps: 0, downloadRateBps: 0 };
        }

        const dt = (now - this._prevNetTime) / 1000; // 转秒
        if (dt <= 0) {
            return { uploadRateBps: 0, downloadRateBps: 0 };
        }

        const rxDelta = rxTotal - this._prevNetBytes.rx;
        const txDelta = txTotal - this._prevNetBytes.tx;

        // 更新缓存
        this._prevNetBytes = { rx: rxTotal, tx: txTotal };
        this._prevNetTime = now;

        // 字节/秒 → 比特/秒 (×8)
        const downloadRateBps = Math.max(0, (rxDelta / dt) * 8);
        const uploadRateBps = Math.max(0, (txDelta / dt) * 8);

        return {
            uploadRateBps: Number.parseFloat(uploadRateBps.toFixed(0)),
            downloadRateBps: Number.parseFloat(downloadRateBps.toFixed(0)),
        };
    }
}
