export class IpcTransport {
    constructor() {
        if (!process.send || !process.connected) {
            throw new Error('IPC 通道不可用');
        }
    }
    send(data) {
        if (process.send) {
            process.send(data);
        }
    }
    onMessage(callback) {
        process.on('message', (msg) => {
            try {
                const obj = typeof msg === 'string' ? JSON.parse(msg) : msg;
                callback(obj);
            }
            catch (e) {
                // 解析错误可在此处理或交给上层
                callback({ error: `解析失败: ${e.message}`, raw: msg });
            }
        });
        // 当 IPC 断开时，发送一个特殊的关闭事件供上层处理
        process.on('disconnect', () => {
            callback({ type: 'internal:disconnect' });
        });
    }
    close() {
        // IPC 通道由系统管理，通常无需显式关闭
    }
}
