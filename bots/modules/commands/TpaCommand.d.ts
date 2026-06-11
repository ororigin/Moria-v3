import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
export declare class TpaCommand extends Command {
    private target;
    constructor(target: string);
    exec(context: IContext): Promise<void>;
}
//# sourceMappingURL=TpaCommand.d.ts.map