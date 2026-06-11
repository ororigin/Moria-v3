//使用命令模块
import { Command } from '../Commands.js';
export class UseCommandCommand extends Command {
    _sender;
    command;
    constructor(_sender, command) {
        super(_sender);
        this._sender = _sender;
        this.command = command;
    }
    async exec(context) {
        const bot = context.getBot();
        bot.chat(`/${this.command}`);
    }
}
//# sourceMappingURL=UseCommandCommand.js.map