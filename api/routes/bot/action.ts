import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ExecuteActionInput } from '../../types/schemas.js';
import { executeActionJSONSchema } from '../../types/schemas.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * POST /api/bots/:id/action — 执行预设动作
 *
 * action 名称由 bot 模块端注册（通过 static actionName），
 * 可通过 params 传递可选的结构化参数。
 *
 * 请求体示例：
 *   { "action": "mountMinecart" }
 *   { "action": "attack", "params": { "frequency": 5 } }
 */
export default async function actionRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post(
        '/:id/action',
        {
            schema: {
                body: executeActionJSONSchema,
            },
        },
        async (
            request: FastifyRequest<{
                Params: { id: string };
                Body: ExecuteActionInput;
            }>,
            reply: FastifyReply,
        ) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;
            const { action, params } = request.body;
            const successFlag = await botManager.executeAction(botId, action, params);

            if (!successFlag) {
                return reply
                    .status(404)
                    .send(error('BOT_NOT_FOUND', `Bot ${botId} 未运行或不存在`));
            }

            return success({ message: '操作已执行', bot_id: botId });
        },
    );
}
