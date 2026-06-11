import { Command } from './Commands.js';
export declare class CommandResolver {
    resolveInGame(username: string, message: string): Command | null;
    resolveStdin(json: any): Command | {
        type: 'privileged';
        action: () => void;
    } | null;
}
//# sourceMappingURL=CommandResolver.d.ts.map