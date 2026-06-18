import { buildApp } from "./app.js";
import { ConfigManagerFactory, ConfigType } from "./storage/config/index.js";
import Logger from "./storage/log/Logger.js";
async function main() {
    // ── 1. 初始化配置系统 ─────────────────────────────────────────────────
    const configFactory = new ConfigManagerFactory("./configs");
    const sysConfigMgr = configFactory.create(ConfigType.SYSTEM, "main");
    const systemConfig = await sysConfigMgr.read();
    // ── 2. 初始化日志系统 ─────────────────────────────────────────────────
    const logger = new Logger(1024 * 1024, systemConfig.logLevel);
    // ── 3. 记录引导开始 ───────────────────────────────────────────────────
    await logger.sysLog("info", "Bootstrap", "Starting Moria-v3 server...");
    // ── 4. 构建 App 实例 ──────────────────────────────────────────────────
    const app = await buildApp({
        logger,
        logLevel: systemConfig.logLevel,
        version: systemConfig.version,
        port: systemConfig.port,
    });
    // ── 5. 启动监听 ───────────────────────────────────────────────────────
    const port = systemConfig.port;
    const host = "0.0.0.0";
    await app.listen({ port, host });
    await logger.sysLog("info", "Bootstrap", `Server listening on http://${host}:${port}`);
    // ── 6. 优雅关闭 ───────────────────────────────────────────────────────
    const shutdown = async (signal) => {
        await logger.sysLog("warn", "Bootstrap", `Received ${signal}, shutting down...`);
        await app.close();
        await logger.sysLog("info", "Bootstrap", "Server closed");
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}
main().catch(async (err) => {
    console.error("[FATAL] Failed to start server:", err);
    process.exit(1);
});
