import { Vec3 } from 'vec3';
import type { Bot } from 'mineflayer';
import { Block } from 'prismarine-block'
import { Entity } from 'prismarine-entity';

// 获取眼睛位置，根据 Pose（姿态）自动调整高度。
export function getEyePosition(bot: Bot): Vec3 {
    const { position, height, metadata } = bot.entity;
    const scale = height / 1.8;
    let eyeHeight = 1.62 * scale;

    if (metadata[6]) {
        const pose = metadata[6] as unknown as number;
        switch (pose) {
            // 鞘翅滑翔、游泳、激流旋转攻击
            case 1:
            case 3:
            case 4:
            case 6:
                eyeHeight = 0.4 * scale;
                break;
            // 潜行
            case 5:
                eyeHeight = 1.27 * scale;
                break;
            // 睡觉
            case 2:
                eyeHeight = 0.2;
                break;
            // 死亡
            case 7:
                eyeHeight = 1.62;
                break;
        }
    }

    return position.offset(0, eyeHeight, 0);
}

// 从 yaw/pitch 计算视线方向单位向量。
export function getLookDirection(bot: Bot): Vec3 {
    const yaw = bot.entity.yaw;
    const pitch = bot.entity.pitch;
    return new Vec3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
    );
}

// 实体筛选
export function isValidTarget(bot: Bot, entity: Entity): boolean {
    if (entity === bot.entity) return false;
    if (!entity.isValid) return false;
    return true;
}

// 从指定实体的视角进行射线追踪，获取视线方向上的第一个方块。
export function blockAtCursor(
    bot: Bot,
    maxDistance: number = 256,
    matcher?: (block: Block) => boolean,
): Block | null {
    if (!bot.entity.position || !bot.entity.height || !bot.entity.pitch || !bot.entity.yaw) return null;
    const eyePosition = getEyePosition(bot);
    const viewDirection = getLookDirection(bot);
    return bot.world.raycast(eyePosition, viewDirection, maxDistance, matcher) as Block | null;
}

//获取实体碰撞盒。
export function getEntityBounds(entity: Entity): { min: Vec3; max: Vec3 } {
    const pos = entity.position;
    const w = (entity.width ?? 0.6) / 2;
    const h = entity.height ?? 1.8;
    const pickRadius = 0; // 默认 getPickRadius = 0
    return {
        min: new Vec3(pos.x - w - pickRadius, pos.y - pickRadius, pos.z - w - pickRadius),
        max: new Vec3(pos.x + w + pickRadius, pos.y + h + pickRadius, pos.z + w + pickRadius),
    };
}
