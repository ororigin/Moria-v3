import type { Transport } from './Transport.js';

export class StdioTransport implements Transport {
    private messageCallbacks: ((data: any) => void)[] = [];

    constructor() {
        this.setupStdin();
    }

    private setupStdin(): void {
        process.stdin.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const obj = JSON.parse(line);
                    this.messageCallbacks.forEach((cb) => cb(obj));
                } catch (e: any) {
                    this.messageCallbacks.forEach((cb) =>
                        cb({ error: `解析 stdin 失败: ${e.message}`, raw: line }),
                    );
                }
            }
        });

        process.stdin.on('end', () => {
            this.messageCallbacks.forEach((cb) => cb({ type: 'internal:stdin_end' }));
        });
    }

    send(data: Record<string, any>): void {
        console.log(JSON.stringify(data));
    }

    onMessage(callback: (data: any) => void): void {
        this.messageCallbacks.push(callback);
    }

    close(): void {
        // 标准输入通常不主动关闭
    }
}
