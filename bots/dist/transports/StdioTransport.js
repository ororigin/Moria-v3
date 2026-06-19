export class StdioTransport {
    messageCallbacks = [];
    constructor() {
        this.setupStdin();
    }
    setupStdin() {
        process.stdin.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const obj = JSON.parse(line);
                    this.messageCallbacks.forEach((cb) => cb(obj));
                }
                catch (e) {
                    this.messageCallbacks.forEach((cb) => cb({ error: `解析 stdin 失败: ${e.message}`, raw: line }));
                }
            }
        });
        process.stdin.on('end', () => {
            this.messageCallbacks.forEach((cb) => cb({ type: 'internal:stdin_end' }));
        });
    }
    send(data) {
        console.log(JSON.stringify(data));
    }
    onMessage(callback) {
        this.messageCallbacks.push(callback);
    }
    close() {
        // 标准输入通常不主动关闭
    }
}
