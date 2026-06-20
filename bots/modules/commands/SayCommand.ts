// 聊天模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class SayCommand extends Command {
    static actionName = 'say';
    static description = '让假人发送聊天消息';
    static paramsTemplate = [
        { name: 'message', type: 'string' as const, required: true, description: '要发送的聊天内容' },
    ];

    constructor(
        private _sender: string,
        private message: string = '',
    ) {
        super(_sender);
    }
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        const msg = this.params?.message ?? this.message;
        if (!msg) return;
        bot.chat(msg);
    }
}
