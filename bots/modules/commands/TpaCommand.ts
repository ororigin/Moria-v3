// 请求传送模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class TpaCommand extends Command {
    static actionName = 'tpa';
    static description = '向指定玩家发送传送请求';
    static paramsTemplate = [
        { name: 'target', type: 'string' as const, required: true, description: '目标玩家名称' },
    ];

    constructor(private target: string = '') {
        super(target);
    }
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        const target = this.params?.target ?? this.target;
        if (!target) return;
        bot.chat(`/tpa ${target}`);
    }
}
