import * as mineflayer from 'mineflayer';
import type { IContext } from '../utils/IContext.js';
import type { CommandDispatcher } from './CommandDispatcher.js';

export class BotManager {
  private bot: mineflayer.Bot | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout | null;
  private shouldExit = false;
  private context: IContext;

  constructor(
    private config: IContext['config'],
    private dispatcher: CommandDispatcher,   // 用于清空队列和中断持久命令
    private onWhisper: (username: string, message: string) => void,
    private sendLog: (msg: string, isError?: boolean) => void = () => {},
    private sendStatus: (status: string) => void = () => {}
  ) {
    this.context = { bot: null, config , getBot() {
        if(!this.bot) throw new Error('Context not fully initialized');
        return this.bot;
    },};
  }

  async start(): Promise<void> {
    this.createBot();
  }

  private createBot(): void {
    try {
      const bot = mineflayer.createBot({
        host: this.config.host,
        port: this.config.port,
        username: this.config.name,
        hideErrors: false,
      });
      this.bot = bot;
      this.context.bot = bot;
      this.bindEvents(bot);
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  private bindEvents(bot: mineflayer.Bot): void {
    bot.on('spawn', () => {
      this.reconnectAttempts = 0;
      this.sendStatus('online');
    });

    bot.on('end', (reason) => {
      this.sendLog(`断开连接: ${reason}`);
      this.sendStatus('offline');
      this.dispatcher.abortAllAndClear();
      if (!this.shouldExit) this.scheduleReconnect();
      else process.exit(0);
    });

    bot.on('kicked', (reason) => {
      this.sendLog(`被踢出: ${reason}`, true);
      this.sendStatus('offline');
      this.dispatcher.abortAllAndClear();
      if (!this.shouldExit) this.scheduleReconnect();
      else process.exit(0);
    });

    bot.on('error', (err) => {
      this.sendLog(`错误: ${err.message}`, true);
      this.sendStatus('offline');
      process.exit(0);
    });

    bot.on('whisper', (username, message) => {
      setImmediate(() => this.onWhisper(username, message));
    });

    // 自动注册/登录的消息监听.
    bot.on('messagestr', (message) => {
      if (message.includes('/reg') && message.includes('注册')) {
        bot.chat(`/reg ${this.config.password} ${this.config.password}@outlook.com`);
      }
      if (message.includes('/l') || message.includes('登录')) {
        bot.chat(`/l ${this.config.password}`);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const auto = typeof (this.config as any).auto_reconnect === 'boolean'
      ? (this.config as any).auto_reconnect
      : typeof (this.config as any).autoReconnect === 'boolean'
        ? (this.config as any).autoReconnect
        : true;
    if (!auto) {
      this.sendLog('自动重连已被禁用，进程退出');
      this.shutdown();
      return;
    }

    const max = typeof (this.config as any).max_reconnect === 'number'
      ? (this.config as any).max_reconnect
      : typeof (this.config as any).maxReconnect === 'number'
        ? (this.config as any).maxReconnect
        : 5;

    const interval = typeof (this.config as any).reconnect_interval === 'number'
      ? (this.config as any).reconnect_interval
      : typeof (this.config as any).reconnectInterval === 'number'
        ? (this.config as any).reconnectInterval
        : 5000;

    if (this.reconnectAttempts >= max) {
      this.sendLog(`达到最大重连次数 (${this.reconnectAttempts}/${max})，退出进程`);
      this.shutdown();
      return;
    }
    this.reconnectAttempts++;
    this.sendLog(`将在${interval / 1000}秒后重连 (${this.reconnectAttempts}/${max})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createBot();
    }, interval);
  }

  // 特权操作：立即退出
  shutdown(): void {
    this.shouldExit = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.bot) this.bot.quit();
    else process.exit(0);
  }

  // sendLog 和 sendStatus 通过构造函数注入，由 bot.ts 提供 transport 输出实现
}