import type { FastifyInstance, FastifyReply } from 'fastify';
import { getBotManager } from '../../middlewares/requireBotManager.js';
import { success } from '../../types/responses.js';

/**
 * GET /api/bots/actions — 获取所有可执行的 action 命令参数模板
 *
 * 返回所有已注册的 action 描述符，包含参数名称、类型、必填、默认值和说明。
 * 需要至少有一个在线 bot 才能获取到数据（数据从 bot 子进程查询）。
 */
export default async function actionsRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get(
        '/actions',
        async (_request, reply: FastifyReply) => {
            const botManager = getBotManager(fastify, reply);
            if (!botManager) return;

            const descriptors = await botManager.getActionDescriptors();
            return success(descriptors);
        },
    );
}
