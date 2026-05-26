import { CommandHandler, Command } from '../moudles/Commands.js';
import type { IContext } from '../utils/IContext.js';

export class CommandDispatcher {
  private handler: CommandHandler;

  constructor(context: IContext, warningHandler?: (type: number) => void) {
    this.handler = new CommandHandler(context, warningHandler);
  }

  dispatch(command: Command): void {
    this.handler.addCommand(command);
  }

  abortAllAndClear(): void { //清空命令
    this.handler.abortCurrentAndClear();
  }
}