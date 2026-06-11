import type { Transport } from './Transport.js';
export declare class IpcTransport implements Transport {
    constructor();
    send(data: Record<string, any>): void;
    onMessage(callback: (data: any) => void): void;
    close(): void;
}
//# sourceMappingURL=IpcTransport.d.ts.map