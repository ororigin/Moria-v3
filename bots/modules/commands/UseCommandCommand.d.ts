import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
export declare class UseCommandCommand extends Command {
    private _sender;
    private command;
    constructor(_sender: string, command: string);
    exec(context: IContext): Promise<void>;
}
//# sourceMappingURL=UseCommandCommand.d.ts.map