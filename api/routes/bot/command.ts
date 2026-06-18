import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SendCommandInput } from '../../types/schemas.js';
import { sendCommandJSONSchema } from '../../types/schemas.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * POST /api/bots/:id/command — 发送聊天命令给 Bot
 */
export default async function commandRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post(
        '/:id/command',
        {
            schema: {
                body: sendCommandJSONSchema,
            },
        },
        async (
            request: FastifyRequest<{
                Params: { id: string };
                Body: SendCommandInput;
            }>,
            reply: FastifyReply,
        ) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;

            const command = request.body.command;
            const successFlag = await botManager.sendCommand(botId, command.trim());

            if (!successFlag) {
                return reply
                    .status(404)
                    .send(error('BOT_NOT_FOUND', `Bot ${botId} 未运行或不存在`));
            }

            return success({ message: '命令已发送', bot_id: botId });
        },
    );
}
