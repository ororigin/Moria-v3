import type { Transport } from './Transport.js';

export class IpcTransport implements Transport {
  constructor() {
    if (!process.send || !process.connected) {
      throw new Error('IPC 通道不可用');
    }
  }

  send(data: Record<string, any>): void {
    if (process.send) {
      process.send(JSON.stringify(data));
    }
  }

  onMessage(callback: (data: any) => void): void {
    process.on('message', (msg: any) => {
      try {
        const obj = typeof msg === 'string' ? JSON.parse(msg) : msg;
        callback(obj);
      } catch (e: any) {
        // 解析错误可在此处理或交给上层
        callback({ error: `解析失败: ${e.message}`, raw: msg });
      }
    });

    // 当 IPC 断开时，发送一个特殊的关闭事件供上层处理
    process.on('disconnect', () => {
      callback({ type: 'internal:disconnect' });
    });
  }

  close(): void {
    // IPC 通道由系统管理，通常无需显式关闭
  }
}