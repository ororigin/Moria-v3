//发送帮助信息
import { CommandInfo } from "./index.js";
import { Command } from '../Commands.js';
export class HelpCommand extends Command {
    target;
    arg;
    constructor(target, arg) {
        super(target);
        this.target = target;
        this.arg = arg;
    }
    async exec(context) {
        const bot = context.getBot();
        if (this.arg == "") {
            bot.chat(`/w ${this.target} 可用命令: ${Object.keys(CommandInfo.descriptions)}`);
        }
        else {
            if (CommandInfo.descriptions[this.arg]) {
                bot.chat(`/w ${this.target} ${CommandInfo.descriptions[this.arg]["description"]}；${CommandInfo.descriptions[this.arg]["usage"]}`);
            }
            else {
                bot.chat(`/w ${this.target} 可用命令: ${Object.keys(CommandInfo.descriptions)}`);
            }
        }
    }
}
