import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import apiRoutes from './api/index.js';
import legacyRoutes from './api/legacy/index.js';
import type ILogger from './storage/log/ILogger.js';
import type { LogLevel } from './storage/log/ILogger.js';
import type { BotManager } from './bot_manager/BotManager.js';
import type { SystemMonitor } from './system/monitor/SystemMonitor.js';

// 选项接口

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
    /** BotManager 实例（管理 Bot 子进程生命周期） */
    botManager?: BotManager;
    /** SystemMonitor 实例（系统性能监控） */
    systemMonitor?: SystemMonitor;
    /** CORS 允许的跨域来源，来自 SystemConfig.allowedOrigins */
    allowedOrigins?: string[];
}

// Fastify 实例类型扩展

declare module 'fastify' {
    interface FastifyInstance {
        /** 通过 decorate 注入的 Moria 系统版本号 */
        appVersion: string;
        /** 通过 decorate 注入的 BotManager 实例 */
        botManager: BotManager;
        /** 通过 decorate 注入的 SystemMonitor 实例 */
        systemMonitor: SystemMonitor;
    }
}

// App 工厂

/**
 * 创建并配置 Fastify 服务器实例
 *
 * @param options - 可选的服务器配置
 * @returns 配置完成的 FastifyInstance（尚未启动监听）
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
    const { logger: appLogger, logLevel = 'info', version = '0.0.0' } = options;

    // 创建 Fastify 实例
    const app = fastify({
        logger: {
            level: logLevel,
            ...(process.env.NODE_ENV !== 'production' && {
                transport: {
                    target: 'pino-pretty',
                    options: { colorize: true },
                },
            }),
        },
        trustProxy: true,
    });

    // 注入版本号供路由使用
    app.decorate('appVersion', version);

    // 注入 BotManager 供路由使用
    if (options.botManager) {
        app.decorate('botManager', options.botManager);
    }

    // 注入 SystemMonitor 供路由使用
    if (options.systemMonitor) {
        app.decorate('systemMonitor', options.systemMonitor);
    }

    // 注册 CORS 插件
    if (options.allowedOrigins && options.allowedOrigins.length > 0) {
        await app.register(cors, {
            origin: options.allowedOrigins,
            credentials: true,
            methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
        });
    }

    // 注册新 RESTful API 路由（/api 前缀）
    await app.register(apiRoutes, { prefix: '/api' });

    // 注册旧路径 308 重定向（保持 v2 向后兼容）
    await app.register(legacyRoutes);

    // 生命周期钩子

    app.addHook('onClose', async () => {
        await appLogger?.sysLog('info', 'Fastify', 'Server closing...');
    });

    app.addHook('onError', async (_request, _reply, error) => {
        await appLogger?.sysLog('error', 'Fastify', `Unhandled error: ${error.message}`);
    });

    return app;
}
