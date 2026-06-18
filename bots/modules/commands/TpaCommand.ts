// 请求传送模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class TpaCommand extends Command {
    constructor(private target: string) {
        super(target);
    }
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        bot.chat(`/tpa ${this.target}`);
    }
}
