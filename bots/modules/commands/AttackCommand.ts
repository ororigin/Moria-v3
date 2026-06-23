//攻击模块
import { PersistentCommand } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
import type { Bot } from 'mineflayer';
import { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import {
    getEyePosition,
    getLookDirection,
    isValidTarget,
    getEntityBounds,
    blockAtCursor,
} from '../utils/entity.js';
import { expandAABB, aabbInSearchBox, rayAABBIntersect } from '../utils/geometry.js';
import { waitForTicks } from '../utils/tick.js';

export class AttackCommand extends PersistentCommand {
    static actionName = 'attack';
    static description = '根据指定频率沿视线循环攻击';
    static paramsTemplate = [
        {
            name: 'intervalTicks',
            type: 'number' as const,
            required: false,
            default: 10,
            description: '攻击间隔（游戏 tick）',
        },
    ];

    private intervalTicks: number = 10;

    constructor(sender: string, intervalTicks?: string) {
        super(sender);
        if (intervalTicks !== undefined) {
            const parsed = parseInt(intervalTicks, 10);
            if (!isNaN(parsed) && parsed > 0) this.intervalTicks = parsed;
        }
    }

    async exec(context: IContext, signal: AbortSignal): Promise<void> {
        const bot = context.getBot();
        // 支持从 IPC params 读取参数
        if (this.params?.intervalTicks != null && this.params.intervalTicks > 0) {
            this.intervalTicks = this.params.intervalTicks;
        }

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
            await waitForTicks(bot, this.intervalTicks, signal);
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

        const eyePos = getEyePosition(bot);
        const lookDir = getLookDirection(bot);

        //方块射线检测
        let blockHitDistSq = maxDistance * maxDistance;
        const blockHit = blockAtCursor(bot, maxDistance);
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
        const searchEnd = eyePos.plus(lookDir.scaled(searchDist));
        const searchBox = expandAABB(bot.entity.position, lookDir, searchDist, 1.0);
        // 实体射线检测
        let closestEntity: Entity | null = null;
        let closestDistSq = blockHitDistSq; // 不能比方块更远
        for (const entity of Object.values(bot.entities)) {
            if (!isValidTarget(bot, entity)) continue;
            // 构建实体碰撞盒
            const bb = getEntityBounds(entity);
            if (!aabbInSearchBox(bb, searchBox)) continue;
            // 射线-包围盒求交
            const hitDistSq = rayAABBIntersect(eyePos, searchEnd, bb);
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
}
