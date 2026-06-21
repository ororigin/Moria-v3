import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateBotInput } from '../../types/schemas.js';
import { createBotJSONSchema } from '../../types/schemas.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * POST /api/bots — 创建并启动新 Bot
 *
 * 请求体 (CreateBotInput):
 *   - name:     Minecraft 用户名（必填）
 *   - server:   服务器地址（必填）
 *   - port:     服务器端口（必填）
 *   - password: 服务器密码（可选）
 */
export default async function createRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post(
        '/',
        {
            schema: {
                body: createBotJSONSchema,
            },
        },
        async (request: FastifyRequest<{ Body: CreateBotInput }>, reply: FastifyReply) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const { name, server, port, password } = request.body;

            // 构造 BotConfig JSON（同时设置 host，确保连接使用正确的服务器地址）
            const configJson = JSON.stringify({
                name: name.trim(),
                host: server.trim(),
                server: server.trim(),
                port,
                ...(password ? { password } : {}),
            });

            try {
                const { botId } = await botManager.createBot(configJson);

                let message: string;
                try {
                    await botManager.startBot(botId);
                    message = `Bot ${botId} 已创建并启动`;
                } catch (startErr) {
                    const detail = startErr instanceof Error ? startErr.message : String(startErr);
                    message = `Bot ${botId} 配置已创建，但启动失败: ${detail}`;
                }

                return reply.status(201).send(success({ message, bot_id: botId }));
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('配置校验失败') || message.includes('JSON')) {
                    return reply.status(400).send(error('INVALID_PARAMS', message));
                }
                return reply.status(500).send(error('CREATE_FAILED', `创建 Bot 失败: ${message}`));
            }
        },
    );
}
