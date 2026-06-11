import type { IContext, BotRuntimeConfig } from './utils/IContext.js';
import { BotManager } from './core/BotManager.js';
import { CommandDispatcher } from './core/CommandDispatcher.js';
import { CommandResolver } from './modules/CommandResolver.js';
import { Command } from './modules/Commands.js';
import { createTransport } from './transports/createTransport.js';
import { isM2CProcessTransportData, type C2MProcessTransportData, type M2CProcessTransportData } from './type/transport.js';

// ─── 配置初始化 ───────────────────────────────────────────────────────────────
// 支持以下方式获取配置（按优先级）：
//   1) argv 提供完整连接参数: node bot.js <botId> <name> <host> <port> [password]
//   2) 父进程 IPC 发送 { type: 'init', config: { ... } }
//   3) argv 提供部分参数 + 默认值降级运行
//
// configured = true  ↔ 来自 IPC 的完整配置（含所有 BotRuntimeConfig 字段）
// configured = false ↔ 仅 argv / 默认值，无完整配置文件

async function main() {
  //  尝试从 argv 解析
  const argvBotId   = process.argv[2];
  const argvName    = process.argv[3];
  const argvHost    = process.argv[4];
  const argvPort    = process.argv[5] ? parseInt(process.argv[5]) : NaN;
  const argvPass    = process.argv[6];

  let config: Partial<BotRuntimeConfig> | null = null;
  /** 是否拥有完整配置（来自 IPC init） */
  let configured = false;

  //argv 提供完整连接参数 
  if (argvBotId && argvName && argvHost && !isNaN(argvPort)) {
    config = {
      botId: argvBotId,
      name: argvName,
      host: argvHost,
      server: argvHost,
      port: argvPort,
      password: argvPass || 'ufdbfcir',
    };
  }
  // 等待 IPC init（10s 超时）
  else {
    config = await new Promise<Partial<BotRuntimeConfig> | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10000);
      const handler = (msg: any) => {
        if (msg && typeof msg === 'object' && msg.type === 'init' && msg.config) {
          clearTimeout(timeout);
          process.off('message', handler);
          resolve(msg.config as Partial<BotRuntimeConfig>);
        }
      };
      process.on('message', handler);
    });

    // IPC 收到了完整配置
    if (config) {
      configured = true;
    }
    //IPC 超时
    else {
      config = {
        ...(argvBotId ? { botId: argvBotId } : {}),
        ...(argvName  ? { name: argvName, displayName: argvName } : {}),
        ...(argvHost  ? { host: argvHost, server: argvHost } : {}),
        ...(!isNaN(argvPort) ? { port: argvPort } : {}),
        ...(argvPass  ? { password: argvPass } : {}),
      };
      if (config.botId || config.name) {
        console.warn(`[bot] 警告: 未收到父进程配置，使用有限参数+默认值启动 (configured=false)`);
      } else {
        // 无法启动
        console.error('[bot] 错误: 未提供 botId 或 name，无法启动');
        console.error('Usage: node bot.js <botId> <name> <host> <port> [password]');
        process.exit(1);
      }
    }
  }

  //规范化并填充全部默认值
  const cfg: BotRuntimeConfig = {
    botId: config.botId ?? '',
    name: config.name ?? '',
    host: config.host || config.server || '',
    server: config.server || config.host || '',
    port: Number(config.port) || 25565,
    password: config.password || 'ufdbfcir',
    autoReconnect: config.autoReconnect ?? true,
    maxReconnect: config.maxReconnect ?? 5,
    reconnectInterval: config.reconnectInterval ?? 5000,
    displayName: config.displayName ?? config.name ?? `Bot-${config.botId}`,
    token: config.token ?? '',
    commandPrefix: config.commandPrefix ?? '!',
    enabled: config.enabled ?? true,
    maxRetries: config.maxRetries ?? 3,
    permissions: config.permissions ?? ['read', 'write'],
    webhookUrl: config.webhookUrl ?? null,
    createdAt: config.createdAt ?? new Date().toISOString(),
    updatedAt: config.updatedAt ?? new Date().toISOString(),
  };

  // 上下文
  const context: IContext = {
    bot: null,
    config: cfg,
    getBot() {
      if (!this.bot) throw new Error();
      return this.bot;
    },
  };

  // 初始化传输层
  const transport = createTransport();

  // ─── 配置同步辅助函数 ─────────────────────────────────────────────────────

  /**
   * 向父进程上报配置变更
   * @param patch  发生变更的配置字段
   */
  function sendConfigUpdate(patch: Partial<BotRuntimeConfig>): void {
    sendOutput('config:update', { config: patch });
  }

  /**
   * 应用父进程推送的配置更新（深度合并到当前 cfg）
   * @param patch  父进程下发的配置字段
   */
  function applyConfigPush(patch: Partial<BotRuntimeConfig>): void {
    Object.assign(cfg, patch);
    sendOutput('log', { message: `配置已更新: ${Object.keys(patch).join(', ')}` });
    // 发送确认
    sendOutput('config:update:ack', { config: patch });
  }

  // 输出辅助函数
  function sendOutput(type: string, data: any = {}): void {
    const output: C2MProcessTransportData = {
      type,
      botId: cfg.botId,
      timestamp: Date.now(),
      ...data,
    };
    transport.send(output);
  }

  // 命令调度器
  const dispatcher = new CommandDispatcher(context, (type) => sendOutput('log', { message: `WARN-${type}` }));

  // 解析器
  const resolver = new CommandResolver();

  // 游戏内私聊处理
  const onWhisper = (username: string, message: string) => {
    const cmd = resolver.resolveInGame(username, message);
    if (cmd) dispatcher.dispatch(cmd);
  };

  // 日志与状态推送（供 BotManager 内部调用）
  const botManagerSendLog = (msg: string, isError = false) => {
    sendOutput('log', { message: msg, error: isError });
  };
  const botManagerSendStatus = (status: string) => {
    sendOutput('status', { status });
  };

  // 创建 BotManager
  const botManager = new BotManager(cfg, dispatcher, onWhisper, botManagerSendLog, botManagerSendStatus);

  // 父进程存活检测
  const HEARTBEAT_TIMEOUT_MS = 16000;
  let heartbeatTimeout: NodeJS.Timeout | null = null;

  function clearHeartbeatTimeout() {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
  }

  function resetHeartbeatTimeout() {
    clearHeartbeatTimeout();
    heartbeatTimeout = setTimeout(() => {
      sendOutput('log', {
        message: `心跳超时（${HEARTBEAT_TIMEOUT_MS / 1000}秒无响应），进程退出`,
        error: true,
      });
      botManager.shutdown();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  // 注册消息处理
  transport.onMessage((msg) => {
    //只处理符合 M2CProcessTransportData 的消息
    if (!isM2CProcessTransportData(msg)) {
      return;
    }
    // 处理关闭事件
    if (msg.type === 'internal:disconnect' || msg.type === 'internal:stdin_end') {
      sendOutput('log', { message: '通信通道关闭，正在退出...' });
      clearHeartbeatTimeout();
      botManager.shutdown();
      return;
    }
    resetHeartbeatTimeout();
    //处理内部事件
    switch (msg.type) {
      //获取pid
      case 'internal:pid':
        sendOutput('internal', { internalType: 'pid', message: { pid: process.pid } });
        return;
      // 查询配置状态
      case 'internal:configured':
        sendOutput('internal', { internalType: 'configured', message: { configured } });
        return;
      // 父进程推送配置更新
      case 'config:push':
        if (msg.config && typeof msg.config === 'object') {
          applyConfigPush(msg.config as Partial<BotRuntimeConfig>);
        }
        return;
    }
    try {
      const result = resolver.resolveStdin(msg);
      if (!result) return;

      if (result instanceof Command) {
        dispatcher.dispatch(result);
      } else if (result.type === 'privileged') {
        sendOutput('log', { message: '收到停止命令，正在退出...' });
        clearHeartbeatTimeout();
        botManager.shutdown();
      }
    } catch (e: any) {
      sendOutput('log', {
        message: `解析消息失败: ${e.message}`,
        error: true,
      });
    }
  });

  //系统信号处理
  process.on('SIGTERM', () => {
    sendOutput('log', { message: '收到 SIGTERM 信号，正在退出...' });
    clearHeartbeatTimeout();
    botManager.shutdown();
  });

  process.on('SIGINT', () => {
    sendOutput('log', { message: '收到 SIGINT 信号，正在退出...' });
    clearHeartbeatTimeout();
    botManager.shutdown();
  });

  // 心跳定时发送
  setInterval(() => {
    sendOutput('heartbeat');
  }, 8000);

  // 上报配置状态
  sendOutput('status', { status: 'starting', configured });

  // 启动 
  botManager.start();
  sendOutput('log', { message: `假人进程启动 - ${cfg.name} @ ${cfg.host}:${cfg.port} (configured=${configured})` });
  resetHeartbeatTimeout();
}

// 启动主流程
main().catch((e) => {
  console.error('启动失败:', e && e.message ? e.message : e);
  process.exit(1);
});