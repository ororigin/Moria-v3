import type { Transport } from './Transport.js';
export declare class StdioTransport implements Transport {
    private messageCallbacks;
    constructor();
    private setupStdin;
    send(data: Record<string, any>): void;
    onMessage(callback: (data: any) => void): void;
    close(): void;
}
//# sourceMappingURL=StdioTransport.d.ts.map