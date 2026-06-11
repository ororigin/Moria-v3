export interface Transport {
    /** 发送消息到父进程/控制台 */
    send(data: Record<string, any>): void;
    /** 注册消息接收回调 */
    onMessage(callback: (data: any) => void): void;
    /** 关闭传输层（可选清理工作） */
    close?(): void;
}
//# sourceMappingURL=Transport.d.ts.map