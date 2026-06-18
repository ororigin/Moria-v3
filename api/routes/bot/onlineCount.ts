import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { success } from "../../types/responses.js";

/**
 * GET /api/bots/online-count — 获取在线 Bot 数量
 */
export default async function onlineCountRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/online-count", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const botManager = fastify.botManager;
    if (!botManager) {
      return success({ count: 0 });
    }
    return success({ count: botManager.getOnlineCount() });
  });
}
