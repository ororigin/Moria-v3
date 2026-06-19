import { Command } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
import { Vec3 } from 'vec3';

export class LookAtBlockCommand extends Command {
    constructor(
        sender: string,
        private target: string,
    ) {
        super(sender);
    }

    async exec(context: IContext, signal?: AbortSignal): Promise<void> {
        const bot = context.getBot();
        // 解析坐标参数
        const coords = this.target.trim().split(/\s+/);
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
