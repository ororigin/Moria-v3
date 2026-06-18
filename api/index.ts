import type { FastifyInstance } from 'fastify';
import apiRoutesGroup from './routes/index.js';

/**
 * API 路由插件入口
 *
 * 此插件在 app.ts 中通过以下方式注册：
 *   app.register(apiRoutes, { prefix: "/api" })
 *   app.register(legacyRoutes)
 *
 * 新 RESTful 路由位于 /api/* 下。
 * 旧路径通过 api/legacy/index.ts 提供 308 重定向。
 */
export default async function apiRoutes(fastify: FastifyInstance): Promise<void> {
    await fastify.register(apiRoutesGroup);
}
