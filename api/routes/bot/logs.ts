import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { LinesQueryInput } from "../../types/schemas.js";
import { linesQuerySchema } from "../../types/schemas.js";
import { getBotManager } from "../../middlewares/requireBotManager.js";
import { success, error } from "../../types/responses.js";

/**
 * GET /api/bots/:id/logs — 获取 Bot 运行日志
 */
export default async function logsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/:id/logs",
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

      const logs = await botManager.getBotLog(botId, "log", lineCount);
      return success({ logs });
    },
  );
}
