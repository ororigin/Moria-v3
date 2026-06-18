// 乘坐模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class MountMinecartCommand extends Command {
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        const minecart = bot.nearestEntity((e: any) => e.name === 'minecart');
        if (minecart) await bot.mount(minecart);
    }
}
