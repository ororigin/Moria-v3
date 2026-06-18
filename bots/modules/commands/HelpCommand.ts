// 发送帮助信息
import { CommandInfo } from './index.js';
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';

export class HelpCommand extends Command {
    constructor(
        private target: string,
        private arg: string,
    ) {
        super(target);
    }
    async exec(context: IContext): Promise<void> {
        const bot = context.getBot();
        if (this.arg == '') {
            bot.chat(`/w ${this.target} 可用命令: ${Object.keys(CommandInfo.descriptions)}`);
        } else {
            if (CommandInfo.descriptions[this.arg]) {
                bot.chat(
                    `/w ${this.target} ${CommandInfo.descriptions[this.arg]!['description']}；${CommandInfo.descriptions[this.arg]!['usage']}`,
                );
            } else {
                bot.chat(`/w ${this.target} 可用命令: ${Object.keys(CommandInfo.descriptions)}`);
            }
        }
    }
}
