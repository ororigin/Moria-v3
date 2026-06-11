import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
export declare class SayCommand extends Command {
    private _sender;
    private message;
    constructor(_sender: string, message: string);
    exec(context: IContext): Promise<void>;
}
//# sourceMappingURL=SayCommand.d.ts.map