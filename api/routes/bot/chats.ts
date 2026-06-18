import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { LinesQueryInput } from "../../types/schemas.js";
import { linesQuerySchema } from "../../types/schemas.js";
import { getBotManager } from "../../middlewares/requireBotManager.js";
import { success, error } from "../../types/responses.js";

/**
 * GET /api/bots/:id/chats — 获取 Bot 聊天记录
 */
export default async function chatsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/:id/chats",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: LinesQueryInput;
      }>,
      reply: FastifyReply,
    ) => {
      const botManager = getBotManager(fastify, reply);
      if (!botManager) return;

      const botId = request.params.id;

      // ── 检查 Bot 是否存在 ──
      const info = await botManager.getBotInfo(botId);
      if (!info) {
        return reply.status(404).send(error("BOT_NOT_FOUND", `Bot ${botId} 不存在`));
      }

      const { lines: lineCount } = linesQuerySchema.parse(request.query);

      const chats = await botManager.getBotLog(botId, "chat", lineCount);
      return success({ chats });
    },
  );
}
