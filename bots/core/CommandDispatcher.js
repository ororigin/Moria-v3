import { CommandHandler, Command } from '../modules/Commands.js';
export class CommandDispatcher {
    handler;
    constructor(context, warningHandler) {
        this.handler = new CommandHandler(context, warningHandler);
    }
    dispatch(command) {
        this.handler.addCommand(command);
    }
    abortAllAndClear() {
        this.handler.abortCurrentAndClear();
    }
}
