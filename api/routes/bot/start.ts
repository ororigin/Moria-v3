import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateBotInput } from '../../types/schemas.js';
import { createBotSchema } from '../../types/schemas.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * POST /api/bots/:id/start — 启动 Bot（自动创建 + 强制启动）
 *
 * 行为：
 *   ├─ Bot 不存在  → body 需 {name, server, port, password?}
 *   │                → createBot() 内部生成 UUID
 *   │                → startBot(newBotId, force)
 *   ├─ Bot 离线    → startBot(botId, force)
 *   └─ Bot 在线    → force=false → 400 拒绝
 *                    force=true  → startBot(botId, force) 内部自动 kill+重启
 *
 * 查询参数:
 *   force (boolean, 默认 false) — 强制重启
 */
export default async function startRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post(
        '/:id/start',
        async (
            request: FastifyRequest<{
                Params: { id: string };
                Body: Partial<CreateBotInput>;
                Querystring: { force?: string };
            }>,
            reply: FastifyReply,
        ) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const botId = request.params.id;
            const force = request.query.force === 'true';

            let targetBotId = botId;
            const existingInfo = await botManager.getBotInfo(botId);

            if (!existingInfo) {
                // Bot 不存在 → 需要先创建
                const parsed = createBotSchema.safeParse(request.body);
                if (!parsed.success) {
                    const firstIssue = parsed.error.issues[0];
                    return reply
                        .status(400)
                        .send(error('INVALID_PARAMS', firstIssue?.message ?? '请求参数无效'));
                }
                const { name, server, port, password } = parsed.data;

                const configJson = JSON.stringify({
                    name: name.trim(),
                    server: server.trim(),
                    port,
                    ...(password ? { password } : {}),
                });

                try {
                    const { botId: newBotId } = await botManager.createBot(configJson);
                    targetBotId = newBotId;

                    try {
                        await botManager.startBot(targetBotId, force);
                    } catch (startErr) {
                        const detail =
                            startErr instanceof Error ? startErr.message : String(startErr);
                        return reply
                            .status(201)
                            .send(
                                success({
                                    message: `Bot ${targetBotId} 配置已创建，但启动失败: ${detail}`,
                                    bot_id: targetBotId,
                                }),
                            );
                    }

                    return reply
                        .status(201)
                        .send(
                            success({
                                message: `Bot ${targetBotId} 已创建并启动`,
                                bot_id: targetBotId,
                            }),
                        );
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    if (message.includes('配置校验失败') || message.includes('JSON')) {
                        return reply.status(400).send(error('INVALID_PARAMS', message));
                    }
                    return reply
                        .status(500)
                        .send(error('CREATE_FAILED', `创建 Bot 失败: ${message}`));
                }
            }

            // Bot 已存在 —— 尝试启动
            try {
                await botManager.startBot(targetBotId, force);
                return reply
                    .status(200)
                    .send(success({ message: `Bot ${targetBotId} 启动中`, bot_id: targetBotId }));
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('无法启动')) {
                    return reply
                        .status(400)
                        .send(
                            error(
                                'BOT_ALREADY_RUNNING',
                                `Bot ${targetBotId} 已在运行中，如需强制重启请设置 force=true`,
                            ),
                        );
                }
                return reply
                    .status(500)
                    .send(error('START_FAILED', `启动 Bot ${targetBotId} 失败: ${message}`));
            }
        },
    );
}
