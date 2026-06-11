//聊天模块
import { Command } from '../Commands.js';
export class SayCommand extends Command {
    _sender;
    message;
    constructor(_sender, message) {
        super(_sender);
        this._sender = _sender;
        this.message = message;
    }
    async exec(context) {
        const bot = context.getBot();
        bot.chat(this.message);
    }
}
