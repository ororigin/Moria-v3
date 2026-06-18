import { Command, TerminateCommand } from './Commands.js';
import {
  SayCommand,
  TpaCommand,
  MountMinecartCommand,
  DismountCommand,
  UseCommandCommand,
  HelpCommand,
} from './commands/index.js';

export class CommandResolver {
  private commandPrefix: string;

  constructor(commandPrefix: string = '!') {
    this.commandPrefix = commandPrefix;
  }

  // 解析游戏内私聊
  resolveInGame(username: string, message: string): Command | null {
    if (!message.startsWith(this.commandPrefix)) return null;
    const parts = message.slice(this.commandPrefix.length).split(' ');
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
      case 'say':
        return new SayCommand(username,arg);
      case 'tpme':
        return new TpaCommand(username);
      case 'minecart':
        return new MountMinecartCommand(username);
      case 'dismount':
        return new DismountCommand(username);
      case 'usecommand':
        return new UseCommandCommand(username,arg);
      case 'help':
        return new HelpCommand(username,arg);
      case 'taskkill':
        return new TerminateCommand(username);
      default:
        return null;
    }
  }

  // 解析标准输入 JSON
  resolveStdin(
    json: any
  ): Command | { type: 'privileged'; action: () => void } | null {
    switch (json.type) {
      case 'chat':
        if (json.msg) return new SayCommand("",json.msg);
        return null;
      case 'action':
        if (json.index === '1') return new MountMinecartCommand("");
        if (json.index === '2') return new DismountCommand("");
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