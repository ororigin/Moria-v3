import { Command, TerminateCommand } from './Commands.js';
import { SayCommand, TpaCommand, MountMinecartCommand, DismountCommand, UseCommandCommand, HelpCommand, } from './commands/index.js';
export class CommandResolver {
    // 解析游戏内私聊（以 # 开头）
    resolveInGame(username, message) {
        if (!message.startsWith('#'))
            return null;
        const parts = message.slice(1).split(' ');
        const cmd = parts[0];
        const arg = parts.slice(1).join(' ');
        switch (cmd) {
            case 'say':
                return new SayCommand(username, arg);
            case 'tpme':
                return new TpaCommand(username);
            case 'minecart':
                return new MountMinecartCommand(username);
            case 'dismount':
                return new DismountCommand(username);
            case 'usecommand':
                return new UseCommandCommand(username, arg);
            case 'help':
                return new HelpCommand(username, arg);
            case 'taskkill':
                return new TerminateCommand(username);
            default:
                return null;
        }
    }
    // 解析标准输入 JSON
    resolveStdin(json) {
        switch (json.type) {
            case 'chat':
                if (json.msg)
                    return new SayCommand("", json.msg);
                return null;
            case 'action':
                if (json.index === '1')
                    return new MountMinecartCommand("");
                if (json.index === '2')
                    return new DismountCommand("");
                return null;
            case 'stop':
                return {
                    type: 'privileged',
                    action: () => {
                        // 特权操作，在主入口调用 botManager.shutdown()
                        // 此处留空，由主入口处理
                    },
                };
            default:
                return null;
        }
    }
}
//# sourceMappingURL=CommandResolver.js.map