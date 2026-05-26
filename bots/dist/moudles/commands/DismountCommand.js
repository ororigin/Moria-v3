//解除乘骑模块
import { Command } from '../Commands.js';
export class DismountCommand extends Command {
    async exec(context) {
        const bot = context.getBot();
        bot.dismount();
    }
}
