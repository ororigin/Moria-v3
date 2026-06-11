import type { IContext } from "../utils/IContext.js";
export declare abstract class Command {
    constructor(sender: string);
    sender: string;
    abstract exec(context: IContext, signal?: AbortSignal): Promise<void>;
}
export declare abstract class PersistentCommand extends Command {
    abstract exec(context: IContext, signal: AbortSignal): Promise<void>;
}
export declare class TerminateCommand extends Command {
    exec(context: IContext, signal?: AbortSignal): Promise<void>;
}
export type WarningHandler = (type: number) => void;
export declare class CommandHandler {
    private queue;
    private isProcessing;
    private currentAbortController;
    private isBlocked;
    private onWarning;
    private context;
    constructor(context: IContext, warningHandler?: WarningHandler);
    addCommand(command: Command): void;
    private terminate;
    abortCurrentAndClear(): void;
    private process;
}
//# sourceMappingURL=Commands.d.ts.map