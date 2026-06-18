import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * GET /health — 健康检查端点
 *
 * 返回服务器运行状态、版本号和当前时间戳。
 * 版本号通过 fastify.decorate("appVersion") 注入。
 */
export default async function healthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: "ok",
      version: fastify.appVersion,
      timestamp: new Date().toISOString(),
    };
  });
}
