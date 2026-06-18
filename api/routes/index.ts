import type { FastifyInstance, FastifyError } from 'fastify';
import healthRoute from './health.js';
import systemRoute from './system.js';
import botRoutes from './bot/index.js';
import { error } from '../types/responses.js';

/**
 * API 路由分组入口
 *
 * 注册所有分组路由（挂载于 /api 下）：
 *   /health       → 健康检查
 *   /system/info  → 系统信息
 *   /bots/*       → Bot 管理
 */
export default async function apiRoutesGroup(fastify: FastifyInstance): Promise<void> {
    // 全局错误处理
    // 捕获所有未处理的异常和 Fastify 校验错误，统一返回 ApiError 格式
    fastify.setErrorHandler(async (err: FastifyError, _request, reply) => {
        const statusCode = err.statusCode ?? 500;
        const message = err.message ?? '内部服务器错误';

        // Fastify 请求校验错误
        if (statusCode === 400 && err.validation) {
            return reply.status(400).send(error('VALIDATION_ERROR', message));
        }

        // 其他错误
        return reply.status(statusCode).send(error('INTERNAL_ERROR', message));
    });

    await fastify.register(healthRoute);
    await fastify.register(systemRoute);
    await fastify.register(botRoutes, { prefix: '/bots' });
}
