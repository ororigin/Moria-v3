import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { BotManager } from "../../bot_manager.js";
import type { ConfigManagerFactory } from "../../storage/config/factory/ConfigManagerFactory.js";
import { ConfigType } from "../../storage/config/factory/ConfigType.js";
import type { BotConfig } from "../../storage/config/types/BotConfig.js";
import type { CreateBotRequest, CreateBotResponse } from "../structure/create_bot.js";

/**
 * 创建 Bot 实例的路由插件
 *
 * 依赖：fastify 实例上必须已装饰 `botManager` 和 `configFactory`
 */
export default async function createBotRoute(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  fastify.post<{ Body: CreateBotRequest; Reply: CreateBotResponse }>(
    "/create_bot",
    async (request, reply) => {
      const { name, server, port, password } = request.body;

      // 1. 生成 Bot UUID
      const botId = randomUUID();

      // 2. 通过配置工厂获取 Bot 配置管理器
      const configFactory: ConfigManagerFactory = (fastify as any).configFactory;
      const botManager: BotManager = (fastify as any).botManager;

      if (!configFactory || !botManager) {
        return reply.status(500).send({
          success: false,
          message: "服务器内部错误：依赖未初始化",
          bot_id: botId,
        });
      }

      try {
        const mgr = configFactory.create<BotConfig>(ConfigType.BOT, botId);

        // 3. 读取已有配置，或自动生成模板配置
        const existing = await mgr.read();

        // 4. 将请求参数合并写入（首次写入会创建文件）
        const fullConfig = await mgr.write({
          botId,
          name,
          host: server,
          server,
          port,
          password: password ?? existing.password,
        });

        // 5. 启动 Bot 子进程
        await botManager.startBot(botId);

        return reply.status(200).send({
          success: true,
          message: `Bot ${name} 已创建并启动`,
          bot_id: botId,
          configPath: mgr.getFilePath(),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          message: `创建 Bot 失败: ${err.message ?? err}`,
          bot_id: botId,
        });
      }
    }
  );
}