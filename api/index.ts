import type { FastifyInstance } from "fastify";
import healthRoute from "./routes/health.js";

/**
 * API 路由插件入口
 * 注册所有 API 子路由
 */
export default async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoute);

  // 未来在此注册更多路由：
  // await fastify.register(require("./routes/bot.js"));
}
