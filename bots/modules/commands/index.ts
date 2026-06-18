export { SayCommand } from './SayCommand.js';
export { TpaCommand } from './TpaCommand.js';
export { MountMinecartCommand } from './MountMinecartCommand.js';
export { DismountCommand } from './DismountCommand.js';
export { UseCommandCommand } from './UseCommandCommand.js';
export { HelpCommand } from './HelpCommand.js';
interface CommandInfoDTO {
    [key: string]: CommandDescriptionDTO;
}

interface CommandDescriptionDTO {
    [key: string]: string;
}

export class CommandInfo {
    public static descriptions: CommandInfoDTO = {
        say: { usage: '使用方法:#say [需要发送的内容(STR)]', description: '发送聊天信息' },
        tpa: { usage: '使用方法:#tpa [目标玩家游戏名(STR)]', description: '向目标玩家发送tpa请求' },
        minecart: { usage: '使用方法:#minecart', description: '乘坐周围最近的矿车' },
        dismount: { usage: '使用方法:#dismount', description: '停止骑乘' },
        usecommand: {
            usage: '使用方法:#usecommand [需要发送的命令，不需要加入斜杠(STR)]',
            description: '发送命令',
        },
    };
}
