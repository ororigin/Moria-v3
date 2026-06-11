//乘坐模块
import { Command } from '../Commands.js';
export class MountMinecartCommand extends Command {
    async exec(context) {
        const bot = context.getBot();
        const minecart = bot.nearestEntity((e) => e.name === 'minecart');
        if (minecart)
            await bot.mount(minecart);
    }
}
//# sourceMappingURL=MountMinecartCommand.js.map