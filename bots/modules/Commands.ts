import type { IContext } from "../utils/IContext.js";

// 命令基类
export abstract class Command {
  constructor(sender: string){
    this.sender=sender;
  }
  public sender: string;
  abstract exec(context: IContext, signal?: AbortSignal): Promise<void>;
}

// 独占型命令
export abstract class PersistentCommand extends Command {
  abstract exec(context: IContext, signal: AbortSignal): Promise<void>;
}

export class TerminateCommand extends Command {
  async exec(context: IContext, signal?: AbortSignal): Promise<void> {
    // TerminateCommand 本身不执行逻辑，它通过 CommandHandler.addCommand 直接触发终止操作。
    // 实际执行在 CommandHandler 的 addCommand 分支中处理。
  }
}

// 警告事件 [0：命令因为阻塞忽略；1：终止命令无效]
export type WarningHandler = (type: number) => void;

// 命令处理器
export class CommandHandler {
  private queue: Command[] = [];
  private isProcessing = false;
  private currentAbortController: AbortController | null = null;
  private isBlocked = false;
  private onWarning: WarningHandler;
  private context: IContext;

  constructor(context: IContext, warningHandler?: WarningHandler) {
    this.context = context;
    this.onWarning = warningHandler ?? ((n) => console.warn(`WARN-${n}`));
  }

  addCommand(command: Command): void {
    if (command instanceof TerminateCommand) {
      this.terminate(command);
      return;
    }
    if (this.isBlocked) {
      this.onWarning(0);
      if(command.sender&&command.sender!=""){
        this.context.bot?.chat(`/w ${command.sender} 假人目前正在工作，所以这个命令被忽略了喵。请使用#taskkill结束目前任务再发送命令哦`)
      }
      return;
    }
    this.queue.push(command);
    if (!this.isProcessing) {
      this.process();
    }
  }

  private terminate(command: TerminateCommand): void {
    if (!this.isBlocked || !this.currentAbortController) {
      this.onWarning(1);
      if(command.sender&&command.sender!=""){
        this.context.bot?.chat(`/w ${command.sender} 目前假人没有在做任何事情，不需要结束任务喵`)
      }
      return;
    }
    this.currentAbortController.abort();
  }

  abortCurrentAndClear(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.queue = [];
    this.isBlocked = false;
    this.isProcessing = false;
  }

  private async process(): Promise<void> {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const command = this.queue[0];
      if (command instanceof PersistentCommand) {
        this.isBlocked = true;
        this.currentAbortController = new AbortController();
        try {
          await command.exec(this.context, this.currentAbortController.signal);
        } catch (error: any) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            console.log('长期任务已被终止');
          } else {
            console.error('长期任务执行出错:', error);
          }
        } finally {
          this.currentAbortController = null;
          this.isBlocked = false;
          this.queue = []; // 清空队列忽略残余命令
        }
      } else {
        if (!command) break;
        try {
          await command.exec(this.context);
        } catch (error) {
          console.error('命令执行失败:', error);
        } finally {
          this.queue.shift();
        }
      }
    }
    this.isProcessing = false;
  }
}