import fastify from "fastify";
import apiRoutes from "./api/index.js";
// ─── App 工厂 ──────────────────────────────────────────────────────────────
/**
 * 创建并配置 Fastify 服务器实例
 *
 * @param options - 可选的服务器配置
 * @returns 配置完成的 FastifyInstance（尚未启动监听）
 */
export async function buildApp(options = {}) {
    const { logger: appLogger, logLevel = "info", version = "0.0.0", } = options;
    // 创建 Fastify 实例
    const app = fastify({
        logger: {
            level: logLevel,
            ...(process.env.NODE_ENV !== "production" && {
                transport: {
                    target: "pino-pretty",
                    options: { colorize: true },
                },
            }),
        },
        trustProxy: true,
    });
    // 注入版本号供路由使用
    app.decorate("appVersion", version);
    // 注册 API 路由
    await app.register(apiRoutes);
    // ── 生命周期钩子 ──
    app.addHook("onClose", async () => {
        await appLogger?.sysLog("info", "Fastify", "Server closing...");
    });
    app.addHook("onError", async (_request, _reply, error) => {
        await appLogger?.sysLog("error", "Fastify", `Unhandled error: ${error.message}`);
    });
    return app;
}
