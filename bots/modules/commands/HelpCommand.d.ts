import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
export declare class HelpCommand extends Command {
    private target;
    private arg;
    constructor(target: string, arg: string);
    exec(context: IContext): Promise<void>;
}
//# sourceMappingURL=HelpCommand.d.ts.map