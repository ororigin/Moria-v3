//聊天模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class SayCommand extends Command {
  constructor(private _sender:string , private message: string) {
    super(_sender);
  }
  async exec(context: IContext): Promise<void> {
    const bot = context.getBot();
    bot.chat(this.message);
  }
}