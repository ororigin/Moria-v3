import { Command } from '../modules/Commands.js';
import type { IContext } from '../utils/IContext.js';
export declare class CommandDispatcher {
    private handler;
    constructor(context: IContext, warningHandler?: (type: number) => void);
    dispatch(command: Command): void;
    abortAllAndClear(): void;
}
//# sourceMappingURL=CommandDispatcher.d.ts.map