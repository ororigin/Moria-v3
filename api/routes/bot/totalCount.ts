import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { success } from "../../types/responses.js";

/**
 * GET /api/bots/total-count — 获取已注册 Bot 总数
 */
export default async function totalCountRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/total-count", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const botManager = fastify.botManager;
    if (!botManager) {
      return success({ count: 0 });
    }
    const count = await botManager.getTotalCount();
    return success({ count });
  });
}
