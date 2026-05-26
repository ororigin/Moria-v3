import { BotManager } from './core/BotManager.js';
import { CommandDispatcher } from './core/CommandDispatcher.js';
import { CommandResolver } from './moudles/CommandResolver.js';
import { Command } from './moudles/Commands.js';
import { createTransport } from './transports/createTransport.js';
import { isM2CProcessTransportData } from './type/transport.js';
// 解析命令行参数
const botId = process.argv[2];
const name = process.argv[3];
const host = process.argv[4];
const port = parseInt(process.argv[5]);
const password = process.argv[6] || 'ufdbfcir';
if (!botId || !name || !host || isNaN(port)) {
    console.error('Usage: node bot.js <botId> <name> <host> <port> [password]');
    process.exit(1);
}
const config = { botId, name, host, port, password };
// 上下文
const context = {
    bot: null,
    config,
    getBot() {
        if (!this.bot)
            throw new Error();
        return this.bot;
    },
};
// 初始化传输层
const transport = createTransport();
// 输出辅助函数
function sendOutput(type, data = {}) {
    const output = {
        type,
        botId,
        timestamp: Date.now(),
        ...data,
    };
    transport.send(output);
}
// 命令调度器
const dispatcher = new CommandDispatcher(context, (type) => sendOutput('log', { message: `WARN-${type}` }));
// 解析器
const resolver = new CommandResolver();
// 游戏内私聊处理
const onWhisper = (username, message) => {
    const cmd = resolver.resolveInGame(username, message);
    if (cmd)
        dispatcher.dispatch(cmd);
};
// 创建 BotManager
const botManager = new BotManager(config, dispatcher, onWhisper);
// 父进程存活检测
const HEARTBEAT_TIMEOUT_MS = 16000;
let heartbeatTimeout = null;
function clearHeartbeatTimeout() {
    if (heartbeatTimeout) {
        clearTimeout(heartbeatTimeout);
        heartbeatTimeout = null;
    }
}
function resetHeartbeatTimeout() {
    clearHeartbeatTimeout();
    heartbeatTimeout = setTimeout(() => {
        sendOutput('log', {
            message: `心跳超时（${HEARTBEAT_TIMEOUT_MS / 1000}秒无响应），进程退出`,
            error: true,
        });
        botManager.shutdown();
    }, HEARTBEAT_TIMEOUT_MS);
}
// 注册消息处理
transport.onMessage((msg) => {
    //只处理符合 M2CProcessTransportData 的消息
    if (!isM2CProcessTransportData(msg)) {
        return;
    }
    // 处理关闭事件
    if (msg.type === 'internal:disconnect' || msg.type === 'internal:stdin_end') {
        sendOutput('log', { message: '通信通道关闭，正在退出...' });
        clearHeartbeatTimeout();
        botManager.shutdown();
        return;
    }
    resetHeartbeatTimeout();
    //处理内部事件
    switch (msg.type) {
        //获取pid
        case "internal:pid":
            sendOutput('internal', { internalType: 'pid', message: { pid: process.pid } });
            return;
    }
    try {
        const result = resolver.resolveStdin(msg);
        if (!result)
            return;
        if (result instanceof Command) {
            dispatcher.dispatch(result);
        }
        else if (result.type === 'privileged') {
            sendOutput('log', { message: '收到停止命令，正在退出...' });
            clearHeartbeatTimeout();
            botManager.shutdown();
        }
    }
    catch (e) {
        sendOutput('log', {
            message: `解析消息失败: ${e.message}`,
            error: true,
        });
    }
});
//系统信号处理
process.on('SIGTERM', () => {
    sendOutput('log', { message: '收到 SIGTERM 信号，正在退出...' });
    clearHeartbeatTimeout();
    botManager.shutdown();
});
process.on('SIGINT', () => {
    sendOutput('log', { message: '收到 SIGINT 信号，正在退出...' });
    clearHeartbeatTimeout();
    botManager.shutdown();
});
// 心跳定时发送
setInterval(() => {
    sendOutput('heartbeat');
}, 8000);
// 启动 
botManager.start();
sendOutput('log', { message: `假人进程启动 - ${name} @ ${host}:${port}` });
resetHeartbeatTimeout();
