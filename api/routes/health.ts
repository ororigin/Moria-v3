import type { FastifyInstance } from "fastify";
import { success } from "../types/responses.js";

/**
 * GET /api/health — 健康检查
 */
export default async function healthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async () => {
    return success({
      status: "ok",
      version: fastify.appVersion,
      timestamp: new Date().toISOString(),
    });
  });
}
