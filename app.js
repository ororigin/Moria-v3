import fastify from "fastify";
import { ConfigManagerFactory } from "./storage/config/factory/ConfigManagerFactory.js";
import { BotManager } from "./bot_manager.js";
import createBotRoute from "./api/routes/create_bot.js";
// ─── 初始化配置工厂（配置文件存放于项目根目录 ./config/） ──────────────────
const configFactory = new ConfigManagerFactory("./config");
// ─── 初始化 Bot 管理器 ─────────────────────────────────────────────────────
const botManager = new BotManager(configFactory);
botManager.registerMessageBus();
// ─── 初始化 Fastify ─────────────────────────────────────────────────────────
const app = fastify({ logger: true });
// 将依赖装饰到 fastify 实例上（路由中通过 (fastify as any) 访问）
app.decorate("configFactory", configFactory);
app.decorate("botManager", botManager);
// ─── 注册路由 ───────────────────────────────────────────────────────────────
app.register(createBotRoute);
export { app, botManager, configFactory };
