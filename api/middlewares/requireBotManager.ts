import type { FastifyReply } from "fastify";
import type { BotManager } from "../../bot_manager/BotManager.js";
import { error } from "../types/responses.js";

/**
 * 从 Fastify 实例中安全获取 BotManager
 *
 * 在路由 handler 中调用，若 BotManager 未就绪则自动发送 500 响应并返回 null。
 * 调用方应 `if (!botManager) return;` 提前退出。
 *
 * @example
 * ```ts
 * const botManager = getBotManager(fastify, reply);
 * if (!botManager) return;
 * ```
 */
export function getBotManager(
  fastify: { botManager?: BotManager },
  reply: FastifyReply,
): BotManager | null {
  const bm = fastify.botManager;
  if (!bm) {
    reply.status(500).send(error("BOT_MANAGER_NOT_READY", "BotManager 未就绪"));
    return null;
  }
  return bm;
}
