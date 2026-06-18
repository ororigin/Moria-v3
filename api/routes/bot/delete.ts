import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * DELETE /api/bots/:id — 删除 Bot
 *
 * 查询参数:
 *   force (boolean, 默认 false) — 如果 Bot 正在运行，先停止再删除
 */
export default async function deleteRoute(fastify: FastifyInstance): Promise<void> {
    fastify.delete(
        '/:id',
        async (
            request: FastifyRequest<{
                Params: { id: string };
                Querystring: { force?: string };
            }>,
            reply: FastifyReply,
        ) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;
            const force = request.query.force === 'true';

            // 先检查 Bot 是否存在
            const info = await botManager.getBotInfo(botId);
            if (!info) {
                return reply.status(404).send(error('BOT_NOT_FOUND', `Bot ${botId} 不存在`));
            }

            try {
                const result = await botManager.deleteBot(botId, { force });
                return success(result);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('仍在运行')) {
                    return reply
                        .status(400)
                        .send(
                            error(
                                'BOT_ALREADY_RUNNING',
                                `Bot ${botId} 仍在运行，请先停止或设置 force=true`,
                            ),
                        );
                }
                return reply
                    .status(500)
                    .send(error('DELETE_FAILED', `删除 Bot ${botId} 失败: ${message}`));
            }
        },
    );
}
