import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BotInfoResponse } from "../../../bot_manager/type/DataStructure.js";
import { getBotManager } from "../../middlewares/requireBotManager.js";
import { success, error } from "../../types/responses.js";

/**
 * GET /api/bots/:id — 获取单个 Bot 信息
 */
export default async function infoRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const botManager = getBotManager(fastify, reply);
      if (!botManager) return;

      const botId = request.params.id;
      const info = await botManager.getBotInfo(botId);

      if (!info) {
        return reply.status(404).send(error("BOT_NOT_FOUND", `Bot ${botId} 不存在`));
      }

      return success(info satisfies BotInfoResponse);
    },
  );
}
