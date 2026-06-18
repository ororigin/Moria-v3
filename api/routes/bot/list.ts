import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { success } from '../../types/responses.js';

/**
 * GET /api/bots — 获取所有 Bot 信息列表
 */
export default async function listRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const botManager = fastify.botManager;
        if (!botManager) {
            return success({ bots: [] });
        }
        const bots = await botManager.getAllBotsInfo();
        return success({ bots });
    });
}
