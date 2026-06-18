import type { Transport } from './Transport.js';
import { IpcTransport } from './IpcTransport.js';
import { StdioTransport } from './StdioTransport.js';

export function createTransport(): Transport {
    // 检测是否在 fork 子进程中（存在 IPC 通道）
    if (process.send && process.connected) {
        return new IpcTransport();
    }
    return new StdioTransport();
}
