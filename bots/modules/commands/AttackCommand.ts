import { PersistentCommand } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
import type { Bot } from 'mineflayer';
import { Block } from 'prismarine-block';
import { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';

export class AttackCommand extends PersistentCommand {
    private readonly intervalTicks: number;

    constructor(sender: string, intervalTicks?: string) {
        super(sender);
        const parsed = intervalTicks ? parseInt(intervalTicks, 10) : NaN;
        this.intervalTicks = !isNaN(parsed) && parsed > 0 ? parsed : 10;
    }

    async exec(context: IContext, signal: AbortSignal): Promise<void> {
        const bot = context.getBot();

        while (!signal.aborted) {
            // 攻击判定
            const target = this.pickTargetEntity(bot);

            if (target) {
                // 有目标
                bot.attack(target);
            } else {
                // 无目标
                bot.swingArm('right', true);
            }

            // 等待 intervalTicks 个游戏 tick，检查终止信号
            for (let i = 0; i < this.intervalTicks && !signal.aborted; i++) {
                await bot.waitForTicks(1);
            }
        }
    }

    /**
     * 沿假人当前视线方向进行一次攻击实体判定。
     * @param bot  mineflayer Bot 实例
     * @returns    准星锁定的攻击目标实体，若无有效目标返回 null
     */
    pickTargetEntity(bot: Bot): Entity | null {
        const entityInteractionRange = 3.0; // ENTITY_INTERACTION_RANGE 属性默认值
        const blockInteractionRange = 4.5; // BLOCK_INTERACTION_RANGE 属性默认值
        const maxDistance = Math.max(blockInteractionRange, entityInteractionRange);

        const eyePos = this.getEyePosition(bot);
        const lookDir = this.getLookDirection(bot);

        //方块射线检测
        let blockHitDistSq = maxDistance * maxDistance;
        const blockHit = bot.blockAtCursor(maxDistance);
        if (blockHit) {
            // 计算方块命中点到眼睛的距离
            const blockCenter = blockHit.position.offset(0.5, 0.5, 0.5);
            const distSq = eyePos.distanceSquared(blockCenter);
            if (distSq < blockHitDistSq) {
                //收缩实体搜索范围
                blockHitDistSq = distSq;
            }
        }
        // 构建搜索 AABB
        const searchDist = Math.sqrt(blockHitDistSq);
        const searchEnd = eyePos.plus(lookDir.scale(searchDist));
        const searchBox = this.expandAABB(bot.entity.position, lookDir, searchDist, 1.0);
        // 实体射线检测
        let closestEntity: Entity | null = null;
        let closestDistSq = blockHitDistSq; // 不能比方块更远
        for (const entity of Object.values(bot.entities)) {
            if (!this.isValidTarget(bot, entity)) continue;
            // 构建实体碰撞盒
            const bb = this.getEntityBounds(entity);
            if (!this.aabbInSearchBox(bb, searchBox)) continue;
            // 射线-包围盒求交
            const hitDistSq = this.rayAABBIntersect(eyePos, searchEnd, bb);
            if (hitDistSq !== null && hitDistSq < closestDistSq) {
                // 同乘骑优先级处理（真实客户端特殊逻辑）
                if (entity.vehicle === bot.entity.vehicle) {
                    if (closestDistSq === blockHitDistSq) {
                        closestEntity = entity;
                        closestDistSq = hitDistSq;
                    }
                    // 同车不覆盖已有更近的
                } else {
                    closestEntity = entity;
                    closestDistSq = hitDistSq;
                }
            }
        }
        // 最终距离校验
        if (!closestEntity) return null;
        if (closestDistSq > entityInteractionRange * entityInteractionRange) return null;
        return closestEntity;
    }

    /**
     * 获取假人眼睛位置。
     * 对应 cameraEntity.getEyePosition(partialTicks)，眼睛高度 ≈ 1.62
     */
    private getEyePosition(bot: Bot): Vec3 {
        const pos = bot.entity.position;
        return new Vec3(pos.x, pos.y + 1.62, pos.z);
    }

    /**
     * 从 yaw/pitch 计算视线方向单位向量。
     * 对应 cameraEntity.getViewVector(partialTicks)
     */
    private getLookDirection(bot: Bot): Vec3 {
        const yaw = bot.entity.yaw;
        const pitch = bot.entity.pitch;
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pitch * Math.PI) / 180;
        return new Vec3(
            -Math.sin(yawRad) * Math.cos(pitchRad),
            -Math.sin(pitchRad),
            Math.cos(yawRad) * Math.cos(pitchRad),
        );
    }

    /**
     * 构建搜索用 AABB。
     * 对应 source.getBoundingBox().expandTowards(direction * maxDistance).inflate(inflate)
     */
    private expandAABB(
        origin: Vec3,
        direction: Vec3,
        distance: number,
        inflate: number,
    ): { min: Vec3; max: Vec3 } {
        const end = origin.plus(direction.scale(distance));
        const min = new Vec3(
            Math.min(origin.x, end.x) - inflate,
            Math.min(origin.y, end.y) - inflate,
            Math.min(origin.z, end.z) - inflate,
        );
        const max = new Vec3(
            Math.max(origin.x, end.x) + inflate,
            Math.max(origin.y, end.y) + inflate,
            Math.max(origin.z, end.z) + inflate,
        );
        return { min, max };
    }

    /**
     * 实体筛选：对应 EntitySelector.CAN_BE_PICKED = Entity::isPickable
     * 排除自身、无效实体、旁观者玩家
     */
    private isValidTarget(bot: Bot, entity: Entity): boolean {
        if (entity === bot.entity) return false;
        if (!entity.isValid) return false;
        if (entity.type === 'player') {
            // 玩家在旁观模式下不可被选中
            // mineflayer 没有暴露 gamemode 属性在 entity 上，跳过此检查
        }
        return true;
    }

    /**
     * 获取实体碰撞盒。
     * 对应 entity.getBoundingBox().inflate(entity.getPickRadius())
     * getPickRadius() 默认 0.0，可被覆盖（如物品展示框）
     */
    private getEntityBounds(entity: Entity): { min: Vec3; max: Vec3 } {
        const pos = entity.position;
        const w = (entity.width ?? 0.6) / 2;
        const h = entity.height ?? 1.8;
        const pickRadius = 0; // 默认 getPickRadius = 0
        return {
            min: new Vec3(pos.x - w - pickRadius, pos.y - pickRadius, pos.z - w - pickRadius),
            max: new Vec3(pos.x + w + pickRadius, pos.y + h + pickRadius, pos.z + w + pickRadius),
        };
    }

    /**
     * 快速过滤：检查实体的 AABB 是否与搜索 AABB 相交
     */
    private aabbInSearchBox(
        bb: { min: Vec3; max: Vec3 },
        searchBox: { min: Vec3; max: Vec3 },
    ): boolean {
        return (
            bb.max.x >= searchBox.min.x &&
            bb.min.x <= searchBox.max.x &&
            bb.max.y >= searchBox.min.y &&
            bb.min.y <= searchBox.max.y &&
            bb.max.z >= searchBox.min.z &&
            bb.min.z <= searchBox.max.z
        );
    }

    /**
     * 射线-AABB 求交（Slab 方法）。
     * 对应 bb.clip(from, to) → Optional<Vec3>
     *
     * @returns 从射线起点到命中点的距离平方，若无交点返回 null
     */
    private rayAABBIntersect(from: Vec3, to: Vec3, bb: { min: Vec3; max: Vec3 }): number | null {
        const dirX = to.x - from.x;
        const dirY = to.y - from.y;
        const dirZ = to.z - from.z;

        let tMin = 0;
        let tMax = 1;

        // X 轴
        const invDirX = 1.0 / dirX;
        let t1 = (bb.min.x - from.x) * invDirX;
        let t2 = (bb.max.x - from.x) * invDirX;
        if (invDirX < 0) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;

        // Y 轴
        const invDirY = 1.0 / dirY;
        t1 = (bb.min.y - from.y) * invDirY;
        t2 = (bb.max.y - from.y) * invDirY;
        if (invDirY < 0) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;

        // Z 轴
        const invDirZ = 1.0 / dirZ;
        t1 = (bb.min.z - from.z) * invDirZ;
        t2 = (bb.max.z - from.z) * invDirZ;
        if (invDirZ < 0) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;

        // 返回命中点到射线起点的距离平方
        const hitX = from.x + dirX * tMin;
        const hitY = from.y + dirY * tMin;
        const hitZ = from.z + dirZ * tMin;
        const dx = hitX - from.x;
        const dy = hitY - from.y;
        const dz = hitZ - from.z;
        return dx * dx + dy * dy + dz * dz;
    }
}
