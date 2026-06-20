// 解除乘骑模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class DismountCommand extends Command {
    static actionName = 'dismount';

    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        bot.dismount();
    }
}
