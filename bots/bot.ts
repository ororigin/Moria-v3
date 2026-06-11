import type { IContext } from './utils/IContext.js';
import { BotManager } from './core/BotManager.js';
import { CommandDispatcher } from './core/CommandDispatcher.js';
import { CommandResolver } from './modules/CommandResolver.js';
import { Command } from './modules/Commands.js';
import { createTransport } from './transports/createTransport.js';
import { isM2CProcessTransportData, type C2MProcessTransportData } from './type/transport.js';

// 支持两种初始化方式：
// 1) 旧的 argv 方式: node bot.js <botId> <name> <host> <port> [password]
// 2) 父进程通过 IPC 发送初始化消息: { type: 'init', config: { botId, name, host, port, password, ... } }

async function main() {
  // 尝试从 argv 解析
  let botId = process.argv[2];
  let name = process.argv[3];
  let host = process.argv[4];
  let port = process.argv[5] ? parseInt(process.argv[5]) : NaN;
  let password = process.argv[6];

  let config: any | null = null;

  if (botId && name && host && !isNaN(port)) {
    config = { botId, name, host, port, password: password || 'ufdbfcir' };
  } else {
    // 等待父进程通过 IPC 发来初始化配置（10s 超时）
    config = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('no-init-config')), 10000);
      const handler = (msg: any) => {
        if (msg && typeof msg === 'object' && (msg.type === 'init' || msg.type === 'config') && msg.config) {
          clearTimeout(timeout);
          process.off('message', handler);
          resolve(msg.config);
        }
      };
      process.on('message', handler);
    }).catch(() => null);
  }

  if (!config) {
    console.error('Usage: node bot.js <botId> <name> <host> <port> [password] OR parent must send init config via IPC');
    process.exit(1);
  }

  // 规范化并填充默认值
  const cfg = {
    botId: config.botId,
    name: config.name,
    host: config.host || config.server || config.hostname,
    port: Number(config.port),
    password: config.password || 'ufdbfcir',
    ...config,
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

  // 启动 
  botManager.start();
  sendOutput('log', { message: `假人进程启动 - ${cfg.name} @ ${cfg.host}:${cfg.port}` });
  resetHeartbeatTimeout();
}

// 启动主流程
main().catch((e) => {
  console.error('启动失败:', e && e.message ? e.message : e);
  process.exit(1);
});