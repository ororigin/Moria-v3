import { Command, TerminateCommand } from './Commands.js';
import {
    SayCommand,
    TpaCommand,
    MountMinecartCommand,
    DismountCommand,
    UseCommandCommand,
    HelpCommand,
    AttackCommand,
    LookAtBlockCommand,
    PlaceBlockCommand,
} from './commands/index.js';
import type { ActionDescriptor } from '../type/transport.js';

//Command 构造函数类型
type CommandConstructor = new (sender: string) => Command;

//注册表条目
interface ActionRegistryEntry {
    ctor: CommandConstructor;
    descriptor: ActionDescriptor;
}

export class CommandResolver {
    //Action 注册表
    private static actionRegistry = new Map<string, ActionRegistryEntry>();

    /**
     * 注册命令
     * @param actionName  action 名称（如 'mountMinecart'）
     * @param ctor        命令构造函数
     * @param descriptor  action 完整描述符（可选，自动从静态属性构建）
     */
    static registerAction(
        actionName: string,
        ctor: CommandConstructor,
        descriptor?: ActionDescriptor,
    ): void {
        CommandResolver.actionRegistry.set(actionName, { ctor, descriptor: descriptor! });
    }

    //获取所有已注册 action 的完整描述符

    static getActionDescriptors(): ActionDescriptor[] {
        return Array.from(CommandResolver.actionRegistry.values()).map((e) => e.descriptor);
    }

    //根据 action 名称获取描述符

    static getActionDescriptor(actionName: string): ActionDescriptor | undefined {
        return CommandResolver.actionRegistry.get(actionName)?.descriptor;
    }

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
            case 'attack':
                return new AttackCommand(username, arg);
            case 'lookat':
                return new LookAtBlockCommand(username, arg);
            case 'placeblock':
                return new PlaceBlockCommand(username, arg);
            case 'taskkill':
                return new TerminateCommand(username);
            default:
                return null;
        }
    }

    // 解析标准输入 JSON
    resolveStdin(json: any): Command | { type: 'privileged'; action: () => void } | null {
        switch (json.type) {
            case 'chat':
                if (json.msg) return new SayCommand('', json.msg);
                return null;
            case 'action': {
                const actionName = json.action || json.index;
                // 向后兼容：旧格式 { type: 'action', index: '1' }
                if (actionName === '1') return new MountMinecartCommand('');
                if (actionName === '2') return new DismountCommand('');

                const entry = CommandResolver.actionRegistry.get(actionName);
                if (!entry) return null;

                const cmd = new entry.ctor('');
                if (json.params && typeof json.params === 'object') {
                    cmd.params = json.params;
                }
                return cmd;
            }
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

//自动注册声明了 static actionName 的命令
function buildDescriptor(
    Ctor: new (sender: string) => Command,
): ActionDescriptor | null {
    const staticSide = Ctor as unknown as typeof Command;
    const actionName = staticSide.actionName;
    if (typeof actionName !== 'string') return null;
    return {
        action: actionName,
        commandName: Ctor.name,
        description: staticSide.description ?? '',
        params: staticSide.paramsTemplate ?? [],
    };
}

function registerActions(...commandClasses: (new (sender: string) => Command)[]): void {
    for (const Ctor of commandClasses) {
        const descriptor = buildDescriptor(Ctor);
        if (descriptor) {
            CommandResolver.registerAction(
                descriptor.action,
                Ctor as unknown as CommandConstructor,
                descriptor,
            );
        }
    }
}

registerActions(
    MountMinecartCommand,
    DismountCommand,
    AttackCommand,
    PlaceBlockCommand,
    LookAtBlockCommand,
    UseCommandCommand,
    TpaCommand,
    SayCommand,
    TerminateCommand,
);
