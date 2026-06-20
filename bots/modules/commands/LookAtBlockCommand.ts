//看向方块模块
import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
import { Vec3 } from 'vec3';

export class LookAtBlockCommand extends Command {
    static actionName = 'lookAtBlock';
    static description = '让假人视线看向指定坐标的方块';
    static paramsTemplate = [
        { name: 'x', type: 'number' as const, required: true, description: '目标方块 X 坐标' },
        { name: 'y', type: 'number' as const, required: true, description: '目标方块 Y 坐标' },
        { name: 'z', type: 'number' as const, required: true, description: '目标方块 Z 坐标' },
    ];

    constructor(
        sender: string,
        private target: string = '',
    ) {
        super(sender);
    }

    async exec(context: IContext, signal?: AbortSignal): Promise<void> {
        const bot = context.getBot();
        // 解析坐标参数（支持从 IPC params 读取）
        let coords: string[];
        if (this.params?.x != null && this.params?.y != null && this.params?.z != null) {
            // 来自 IPC params 的结构化参数
            const { x, y, z } = this.params;
            coords = [String(x), String(y), String(z)];
        } else {
            coords = this.target.trim().split(/\s+/);
        }
        // 合法性检验
        if (coords.length !== 3) {
            const msg = `参数不对哦，需要3个参数确定方块坐标 (x y z)，当前只收到了 ${coords.length} 个参数`;
            if (this.sender) {
                bot.chat(`/w ${this.sender} ${msg}`);
            }
            return;
        }
        const [rawX, rawY, rawZ] = coords;
        const x = Number(rawX);
        const y = Number(rawY);
        const z = Number(rawZ);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            const msg = `坐标格式不对喵，请提供有效的数字坐标，例如：0 64 0`;
            if (this.sender) {
                bot.chat(`/w ${this.sender} ${msg}`);
            }
            return;
        }
        const point = new Vec3(x + 0.5, y + 0.5, z + 0.5);
        await bot.lookAt(point);
    }
}
