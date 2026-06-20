import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ExecuteActionInput } from '../../types/schemas.js';
import { executeActionJSONSchema } from '../../types/schemas.js';
import type { ActionDescriptor, ActionParamDescriptor } from '../../../type/transport.js';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success, error } from '../../types/responses.js';

/**
 * 根据参数模板校验并清理 params
 * @returns 校验通过的 params 对象；若校验失败返回错误字符串
 */
function validateParamsByTemplate(
    template: ActionParamDescriptor[],
    params: Record<string, any> | undefined,
): { valid: true; cleaned: Record<string, any> } | { valid: false; message: string } {
    const cleaned: Record<string, any> = {};

    for (const field of template) {
        const value = params?.[field.name];

        if (value === undefined) {
            if (field.required) {
                return {
                    valid: false,
                    message: `缺少必填参数 "${field.name}": ${field.description}`,
                };
            }
            // 非必填且无值，跳过
            continue;
        }

        // 类型校验
        const actualType = typeof value;
        if (actualType !== field.type) {
            return {
                valid: false,
                message: `参数 "${field.name}" 类型应为 ${field.type}，实际为 ${actualType}`,
            };
        }

        cleaned[field.name] = value;
    }

    return { valid: true, cleaned };
}

/**
 * POST /api/bots/:id/action — 执行预设动作
 *
 * action 名称由 bot 模块端注册（通过 static actionName），
 * 可通过 params 传递可选的结构化参数。
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

            // 按参数模板校验
            const descriptors = await botManager.getActionDescriptors();
            const descriptor = descriptors.find((d: ActionDescriptor) => d.action === action);

            if (!descriptor) {
                return reply
                    .status(400)
                    .send(
                        error(
                            'ACTION_NOT_FOUND',
                            `未找到 action "${action}"，请先通过 GET /api/bots/actions 查看可用动作`,
                        ),
                    );
            }

            // 有参数模板时校验 params
            if (descriptor.params.length > 0) {
                const validation = validateParamsByTemplate(descriptor.params, params);
                if (!validation.valid) {
                    return reply.status(400).send(error('INVALID_PARAMS', validation.message));
                }
                const successFlag = await botManager.executeAction(
                    botId,
                    action,
                    validation.cleaned,
                );
                if (!successFlag) {
                    return reply
                        .status(404)
                        .send(error('BOT_NOT_FOUND', `Bot ${botId} 未运行或不存在`));
                }
                return success({ message: '操作已执行', bot_id: botId });
            }

            // 无参数模板 — 直接转发
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
