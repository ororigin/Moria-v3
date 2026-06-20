import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UpdateBotConfigInput } from '../../types/schemas.js';
import { updateBotConfigJSONSchema } from '../../types/schemas.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * Bot 配置获取与更新路由
 *
 *   GET   /api/bots/:id/config  — 获取 Bot 完整配置（不含 password）
 *   PATCH /api/bots/:id/config  — 部分更新 Bot 配置
 */
export default async function configRoute(fastify: FastifyInstance): Promise<void> {
    //获取配置
    fastify.get(
        '/:id/config',
        async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;
            const config = await botManager.getBotConfig(botId);

            if (!config) {
                return reply.status(404).send(error('BOT_NOT_FOUND', `Bot ${botId} 不存在`));
            }

            // 排除 password 字段
            const { password: _, ...safeConfig } = config;
            return success(safeConfig);
        },
    );

    //更新配置
    fastify.patch(
        '/:id/config',
        {
            schema: {
                body: updateBotConfigJSONSchema,
            },
        },
        async (
            request: FastifyRequest<{
                Params: { id: string };
                Body: UpdateBotConfigInput;
            }>,
            reply: FastifyReply,
        ) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;

            // 检查 Bot 是否存在
            const existingConfig = await botManager.getBotConfig(botId);
            if (!existingConfig) {
                return reply.status(404).send(error('BOT_NOT_FOUND', `Bot ${botId} 不存在`));
            }

            // 推送配置更新
            await botManager.pushConfig(botId, request.body as Partial<import('../../../storage/config/types/BotConfig.js').BotConfig>);

            // 重新读取最新配置返回
            const updatedConfig = await botManager.getBotConfig(botId);
            if (!updatedConfig) {
                return reply.status(500).send(error('READ_CONFIG_FAILED', '更新后读取配置失败'));
            }

            const { password: _, ...safeConfig } = updatedConfig;
            return success(safeConfig);
        },
    );
}
