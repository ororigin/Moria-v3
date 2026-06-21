import { buildApp } from './app.js';
import { ConfigManagerFactory, ConfigType } from './storage/config/index.js';
import type { SystemConfig } from './storage/config/index.js';
import Logger from './storage/log/Logger.js';
import { BotManager } from './bot_manager/BotManager.js';
import { SystemMonitor } from './system/monitor/SystemMonitor.js';

async function main(): Promise<void> {
    // 初始化配置系统
    const configFactory = new ConfigManagerFactory('./configs');
    const sysConfigMgr = configFactory.create<SystemConfig>(ConfigType.SYSTEM, 'main');
    const systemConfig = await sysConfigMgr.read();

    // 初始化日志系统
    const logger = new Logger(1024 * 1024, systemConfig.logLevel);

    // 记录引导开始
    await logger.sysLog('info', 'Bootstrap', 'Starting Moria-v3 server...');

    // 初始化 BotManager
    const botManager = new BotManager(configFactory);
    botManager.setLogger(logger);
    botManager.registerMessageBus();
    botManager.startHeartbeatMonitor();
    await logger.sysLog('info', 'Bootstrap', 'BotManager initialized');

    // 初始化系统监控
    const systemMonitor = new SystemMonitor(2000, logger);
    systemMonitor.start();
    await logger.sysLog('info', 'Bootstrap', 'SystemMonitor started');

    // 构建 App 实例
    const app = await buildApp({
        logger,
        logLevel: systemConfig.logLevel,
        version: systemConfig.version,
        port: systemConfig.port,
        botManager,
        systemMonitor,
        allowedOrigins: systemConfig.allowedOrigins,
    });

    // 启动监听
    const port = systemConfig.port;
    const host = '0.0.0.0';
    await app.listen({ port, host });

    await logger.sysLog('info', 'Bootstrap', `Server listening on http://${host}:${port}`);

    // 优雅关闭
    const shutdown = async (signal: string): Promise<void> => {
        await logger.sysLog('warn', 'Bootstrap', `Received ${signal}, shutting down...`);
        systemMonitor.stop();
        botManager.stopHeartbeatMonitor();
        await app.close();
        await logger.sysLog('info', 'Bootstrap', 'Server closed');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (err) => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});
