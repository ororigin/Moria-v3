import { Vec3 } from 'vec3';
import type { Bot } from 'mineflayer';
import { Entity } from 'prismarine-entity';

//获取假人眼睛位置。

export function getEyePosition(bot: Bot): Vec3 {
    const pos = bot.entity.position;
    return new Vec3(pos.x, pos.y + 1.62, pos.z);
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
