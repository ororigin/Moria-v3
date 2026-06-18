import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * 旧路径 308 重定向路由
 *
 * 将 v2/v3 旧路径永久重定向到新的 RESTful /api/* 路径。
 * 使用 308 状态码以保留请求方法和请求体。
 */
export default async function legacyRoutes(fastify: FastifyInstance): Promise<void> {
  const REDIRECT_CODE = 308;

  // ── 健康检查 ──
  fastify.get("/health", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/health", REDIRECT_CODE);
  });

  // ── Bot 操作 ──
  fastify.post("/create_bot", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/bots", REDIRECT_CODE);
  });

  fastify.get("/online_count", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/bots/online-count", REDIRECT_CODE);
  });

  fastify.get("/total_count", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/bots/total-count", REDIRECT_CODE);
  });

  fastify.get("/bots", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/bots", REDIRECT_CODE);
  });

  fastify.get("/bot/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}`, REDIRECT_CODE);
  });

  fastify.delete("/bot/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}`, REDIRECT_CODE);
  });

  fastify.post("/start_bot/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/start`, REDIRECT_CODE);
  });

  fastify.post("/stop_bot/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/stop`, REDIRECT_CODE);
  });

  fastify.post("/send_command/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/command`, REDIRECT_CODE);
  });

  fastify.post("/execute_action/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/action`, REDIRECT_CODE);
  });

  fastify.get("/get_logs/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/logs`, REDIRECT_CODE);
  });

  fastify.get("/get_chats/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return reply.redirect(`/api/bots/${id}/chats`, REDIRECT_CODE);
  });

  // ── 系统信息 ──
  fastify.get("/system_info", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/api/system/info", REDIRECT_CODE);
  });
}
