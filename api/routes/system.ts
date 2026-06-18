import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { success } from '../types/responses.js';

/**
 * GET /api/system/info — 获取系统性能信息
 *
 * 返回 snake_case 字段（v2 Flask 兼容）：
 *   cpu_percent, memory_percent, upload_rate_bps, download_rate_bps, timestamp
 */
export default async function systemRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/system/info', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const systemMonitor = fastify.systemMonitor;
        if (!systemMonitor) {
            return success({
                cpu_percent: 0,
                memory_percent: 0,
                upload_rate_bps: 0,
                download_rate_bps: 0,
                timestamp: new Date().toISOString(),
            });
        }

        const info = systemMonitor.getInfo();
        return success({
            cpu_percent: info.cpuPercent,
            memory_percent: info.memoryPercent,
            upload_rate_bps: info.uploadRateBps,
            download_rate_bps: info.downloadRateBps,
            timestamp: new Date(info.timestamp).toISOString(),
        });
    });
}
