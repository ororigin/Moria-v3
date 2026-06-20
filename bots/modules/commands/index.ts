export { SayCommand } from './SayCommand.js';
export { TpaCommand } from './TpaCommand.js';
export { MountMinecartCommand } from './MountMinecartCommand.js';
export { DismountCommand } from './DismountCommand.js';
export { UseCommandCommand } from './UseCommandCommand.js';
export { HelpCommand } from './HelpCommand.js';
export { AttackCommand } from './AttackCommand.js';
export { LookAtBlockCommand } from './LookAtBlockCommand.js';
export { PlaceBlockCommand } from './PlaceBlockCommand.js';
interface CommandInfoDTO {
    [key: string]: CommandDescriptionDTO;
}

interface CommandDescriptionDTO {
    [key: string]: string;
}

export class CommandInfo {
    public static descriptions: CommandInfoDTO = {
        say: { usage: '使用方法:#say <需要发送的内容>', description: '发送聊天信息' },
        tpme: { usage: '使用方法:#tpme', description: '向指令发送者发送tpa请求' },
        minecart: { usage: '使用方法:#minecart', description: '乘坐周围最近的矿车' },
        dismount: { usage: '使用方法:#dismount', description: '停止骑乘' },
        usecommand: {
            usage: '使用方法:#usecommand <需要发送的命令，不需要加入斜杠>',
            description: '发送命令',
        },
        attack: {
            usage: '使用方法:#attack <攻击频率(单位:gt)>',
            description: '根据指定频率沿视线循环攻击，默认频率为10tick',
        },
        lookat: {
            usage: '使用方法:#lookat <x> <y> <z>',
            description: '让假人视线看向指定坐标的方块',
        },
        placeblock: {
            usage: '使用方法:#placeblock <放置间隔(单位:gt)>',
            description: '根据指定频率沿视线循环放置当前手持方块，默认间隔5tick',
        },
    };
}
