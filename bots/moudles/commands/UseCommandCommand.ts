//使用命令模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class UseCommandCommand extends Command {
  constructor(private _sender: string , private command: string) {
    super(_sender);
  }
  async exec(context: IContext): Promise<void> {
    const bot = context.getBot();
    bot.chat(`/${this.command}`);
  }
}