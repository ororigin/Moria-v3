//请求传送模块
import { Command } from '../Commands.js';
export class TpaCommand extends Command {
    target;
    constructor(target) {
        super(target);
        this.target = target;
    }
    async exec(context) {
        const bot = context.getBot();
        bot.chat(`/tpa ${this.target}`);
    }
}
