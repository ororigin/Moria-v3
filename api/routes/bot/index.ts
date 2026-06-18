import type { FastifyInstance } from "fastify";
import createRoute from "./create.js";
import listRoute from "./list.js";
import infoRoute from "./info.js";
import deleteRoute from "./delete.js";
import onlineCountRoute from "./onlineCount.js";
import totalCountRoute from "./totalCount.js";
import startRoute from "./start.js";
import stopRoute from "./stop.js";
import commandRoute from "./command.js";
import actionRoute from "./action.js";
import logsRoute from "./logs.js";
import chatsRoute from "./chats.js";

/**
 * Bot 管理路由插件入口
 *
 * 注册所有 Bot 相关子路由（挂载于 /api/bots 下）：
 *   POST   /              → 创建 Bot
 *   GET    /              → 获取所有 Bot 列表
 *   GET    /online-count  → 在线 Bot 数
 *   GET    /total-count   → Bot 总数
 *   GET    /:id           → 单个 Bot 信息
 *   GET    /:id/logs      → Bot 日志
 *   GET    /:id/chats     → Bot 聊天记录
 *   POST   /:id/start     → 启动 Bot
 *   POST   /:id/stop      → 停止 Bot
 *   POST   /:id/command   → 发送命令
 *   POST   /:id/action    → 执行动作
 *   DELETE /:id           → 删除 Bot
 */
export default async function botRoutes(fastify: FastifyInstance): Promise<void> {
  // ── 静态路由优先注册，避免被 /:id 参数路由误匹配 ──
  await fastify.register(createRoute);
  await fastify.register(listRoute);
  await fastify.register(onlineCountRoute);
  await fastify.register(totalCountRoute);

  // ── 参数路由 ──
  await fastify.register(infoRoute);
  await fastify.register(logsRoute);
  await fastify.register(chatsRoute);
  await fastify.register(startRoute);
  await fastify.register(stopRoute);
  await fastify.register(commandRoute);
  await fastify.register(actionRoute);
  await fastify.register(deleteRoute);
}
