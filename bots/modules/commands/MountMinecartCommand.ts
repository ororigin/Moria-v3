// 乘坐模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class MountMinecartCommand extends Command {
    static actionName = 'mountMinecart';
    static description = '乘坐周围最近的矿车';
    static paramsTemplate = [];

    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        const minecart = bot.nearestEntity((e: any) => e.name === 'minecart');
        if (minecart) await bot.mount(minecart);
    }
}
