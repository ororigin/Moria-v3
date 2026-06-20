// 使用命令模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class UseCommandCommand extends Command {
    static actionName = 'useCommand';
    static description = '让假人执行服务器指令';
    static paramsTemplate = [
        { name: 'command', type: 'string' as const, required: true, description: '需要执行的指令（不需要斜杠）' },
    ];

    constructor(
        private _sender: string,
        private command: string = '',
    ) {
        super(_sender);
    }
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        const cmd = this.params?.command ?? this.command;
        if (!cmd) return;
        bot.chat(`/${cmd}`);
    }
}
