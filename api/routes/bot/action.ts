import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ExecuteActionInput } from "../../types/schemas.js";
import { executeActionJSONSchema } from "../../types/schemas.js";
import { getBotManager } from "../../middlewares/requireBotManager.js";
import { success, error } from "../../types/responses.js";

/**
 * POST /api/bots/:id/action — 执行预设动作
 *
 * 支持的动作索引：
 *   '1' — 乘坐周围最近的矿车（MountMinecartCommand）
 *   '2' — 停止骑乘（DismountCommand）
 */
export default async function actionRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/:id/action",
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

      const action = request.body.action;
      const successFlag = await botManager.executeAction(botId, action);

      if (!successFlag) {
        return reply.status(404).send(error("BOT_NOT_FOUND", `Bot ${botId} 未运行或不存在`));
      }

      return success({ message: "操作已执行", bot_id: botId });
    },
  );
}
