import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import apiRoutes from "./api/index.js";
import type ILogger from "./storage/log/ILogger.js";
import type { LogLevel } from "./storage/log/ILogger.js";

// ─── 选项接口 ──────────────────────────────────────────────────────────────

export interface AppOptions {
  /** 项目级 Logger 实例（用于 sysLog 记录生命周期事件） */
  logger?: ILogger;
  /** Fastify pino logger 级别，默认 "info" */
  logLevel?: LogLevel;
  /** 系统版本号，取自 SystemConfig.version */
  version?: string;
  /** 监听地址，默认 "0.0.0.0" */
  host?: string;
  /** 监听端口，默认 3000，来自 SystemConfig.port */
  port?: number;
}

// ─── Fastify 实例类型扩展 ─────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    /** 通过 decorate 注入的 Moria 系统版本号 */
    appVersion: string;
  }
}

// ─── App 工厂 ──────────────────────────────────────────────────────────────

/**
 * 创建并配置 Fastify 服务器实例
 *
 * @param options - 可选的服务器配置
 * @returns 配置完成的 FastifyInstance（尚未启动监听）
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const {
    logger: appLogger,
    logLevel = "info",
    version = "0.0.0",
  } = options;

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
