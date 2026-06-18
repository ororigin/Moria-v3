import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * POST /api/bots/:id/stop — 停止 Bot
 */
export default async function stopRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post(
        '/:id/stop',
        async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;

            const info = await botManager.getBotInfo(botId);
            if (!info) {
                return reply.status(404).send(error('BOT_NOT_FOUND', `Bot ${botId} 不存在`));
            }

            try {
                const result = await botManager.stopBot(botId);
                return success({ message: result.message, status: '离线', bot_id: botId });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return reply
                    .status(500)
                    .send(error('STOP_FAILED', `停止 Bot ${botId} 失败: ${message}`));
            }
        },
    );
}
