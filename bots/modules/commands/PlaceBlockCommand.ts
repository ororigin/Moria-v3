// 放置方块模块
import { PersistentCommand } from '../Commands.js';
import type { IContext } from '../../utils/IContext.js';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { getEyePosition, getLookDirection, blockAtCursor } from '../utils/entity.js';
import { waitForTicks } from '../utils/tick.js';

//块交互距离（对应 Attributes.BLOCK_INTERACTION_RANGE）
const BLOCK_INTERACTION_RANGE = 4.5;

//placeBlock 调用超时
const PLACE_TIMEOUT_MS = 1000;

//放置位置距眼睛的最小距离
const MIN_PLACE_DIST = 0.5;

//已知可替换方块的名称集合
const REPLACEABLE_BLOCK_NAMES = new Set<string>([
    'air',
    'water',
    'flowing_water',
    'lava',
    'flowing_lava',
    'grass',
]);

//判断方块是否可被替换
function isReplaceableBlock(block: any): boolean {
    if (!block) return false;
    if (typeof block.canBeReplaced === 'boolean') return block.canBeReplaced;
    return REPLACEABLE_BLOCK_NAMES.has(block.name);
}

/**
 * 通过射线与方块 AABB 的 6 个面求交，确定命中面和命中点。
 *
 * @returns hitFace 向量（指向方块外部）和命中点坐标，无有效交点返回 null
 */
function getHitFace(
    eyePos: Vec3,
    lookDir: Vec3,
    hitBlock: any,
    maxDistance: number,
): { faceVec: Vec3; hitPos: Vec3 } | null {
    const pos = hitBlock.position as Vec3;
    // 6 个面的定义：[planePoint, normal]
    const faces: [Vec3, Vec3][] = [
        [pos, new Vec3(-1, 0, 0)], // west face  (x = bx)
        [pos.offset(1, 0, 0), new Vec3(1, 0, 0)], // east face (x = bx+1)
        [pos, new Vec3(0, -1, 0)], // bottom face (y = by)
        [pos.offset(0, 1, 0), new Vec3(0, 1, 0)], // top face (y = by+1)
        [pos, new Vec3(0, 0, -1)], // north face (z = bz)
        [pos.offset(0, 0, 1), new Vec3(0, 0, 1)], // south face (z = bz+1)
    ];

    let closestT = Infinity;
    let closestFace: Vec3 | null = null;
    let closestHitPos: Vec3 | null = null;

    for (const [planePoint, normal] of faces) {
        const denom = lookDir.dot(normal);
        if (Math.abs(denom) < 1e-8) continue; // 射线平行于该面

        const t = planePoint.minus(eyePos).dot(normal) / denom;
        if (t < 0 || t > maxDistance) continue;

        const hitPos = eyePos.plus(lookDir.scaled(t));

        // 检查命中点是否在面的边界内（排除方块内部面）
        const eps = 1e-5;
        if (normal.x !== 0) {
            // yz 平面 — 检查 y、z 坐标
            if (hitPos.y < pos.y - eps || hitPos.y > pos.y + 1 + eps) continue;
            if (hitPos.z < pos.z - eps || hitPos.z > pos.z + 1 + eps) continue;
        } else if (normal.y !== 0) {
            // xz 平面 — 检查 x、z 坐标
            if (hitPos.x < pos.x - eps || hitPos.x > pos.x + 1 + eps) continue;
            if (hitPos.z < pos.z - eps || hitPos.z > pos.z + 1 + eps) continue;
        } else {
            // xy 平面 — 检查 x、y 坐标
            if (hitPos.x < pos.x - eps || hitPos.x > pos.x + 1 + eps) continue;
            if (hitPos.y < pos.y - eps || hitPos.y > pos.y + 1 + eps) continue;
        }

        if (t < closestT) {
            closestT = t;
            closestFace = normal;
            closestHitPos = hitPos;
        }
    }

    if (closestFace && closestHitPos) {
        return { faceVec: closestFace, hitPos: closestHitPos };
    }
    return null;
}

/**
 * 在目标位置的视线反方向查找邻域方块作为 referenceBlock。
 *
 * @returns refBlock 和指向目标位置的 faceVector，无可依附方块时返回 null
 */
function findNeighborRefBlock(
    bot: Bot,
    targetPos: Vec3,
    preferDir: Vec3,
): { refBlock: any; faceVector: Vec3 } | null {
    const neighborPos = targetPos.minus(preferDir);
    const neighbor = bot.blockAt(neighborPos);
    if (neighbor && neighbor.name !== 'air') {
        return { refBlock: neighbor, faceVector: preferDir };
    }
    return null;
}

/** 带超时的 placeBlock，避免 mineflayer 内部 5000ms 超时卡死循环 */
async function placeBlockWithTimeout(
    bot: Bot,
    refBlock: any,
    faceVector: Vec3,
    timeoutMs: number,
): Promise<void> {
    await Promise.race([
        (bot as any)._placeBlockWithOptions(refBlock, faceVector, {
            swingArm: 'right',
            forceLook: 'ignore',
        }),
        new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`placeBlock 超时(${timeoutMs}ms)`)), timeoutMs),
        ),
    ]);
}

export class PlaceBlockCommand extends PersistentCommand {
    static actionName = 'placeBlock';
    static description = '根据指定频率沿视线循环放置当前手持方块';
    static paramsTemplate = [
        {
            name: 'intervalTicks',
            type: 'number' as const,
            required: false,
            default: 5,
            description: '放置间隔（游戏 tick）',
        },
    ];

    private intervalTicks: number = 5;

    /**
     * @param sender           命令发送者
     * @param intervalTicksArg 循环间隔（tick），默认 5
     */
    constructor(sender: string, intervalTicksArg?: string) {
        super(sender);
        if (intervalTicksArg !== undefined) {
            const parsed = parseInt(intervalTicksArg, 10);
            if (!isNaN(parsed) && parsed > 0) this.intervalTicks = parsed;
        }
    }

    async exec(context: IContext, signal: AbortSignal): Promise<void> {
        const bot = context.getBot();
        if (this.params?.intervalTicks != null && this.params.intervalTicks > 0) {
            this.intervalTicks = this.params.intervalTicks;
        }

        while (!signal.aborted) {
            try {
                await this.tryPlace(bot);
            } catch (_err) {
                // 单次放置失败不中断循环
            }

            await waitForTicks(bot, this.intervalTicks, signal);
        }
    }

    /**
     * 单次放置逻辑：沿视线检测方块并尝试放置。
     */
    private async tryPlace(bot: Bot): Promise<void> {
        const heldItem = bot.heldItem;
        if (!heldItem) return;

        const eyePos = getEyePosition(bot);
        const lookDir = getLookDirection(bot);

        const hitBlock = blockAtCursor(bot, BLOCK_INTERACTION_RANGE);
        if (!hitBlock) return;

        const hitResult = getHitFace(eyePos, lookDir, hitBlock, BLOCK_INTERACTION_RANGE);
        if (!hitResult) return;

        const { faceVec } = hitResult;
        const isReplaceable = isReplaceableBlock(hitBlock);

        let refBlock: any;
        let faceVector: Vec3;

        if (isReplaceable) {
            const result = findNeighborRefBlock(bot, hitBlock.position, faceVec);
            if (!result) return;
            refBlock = result.refBlock;
            faceVector = result.faceVector;
        } else {
            refBlock = hitBlock;
            faceVector = faceVec;
        }

        // 距离校验
        const placePos = refBlock.position.plus(faceVector);
        const placeCenter = placePos.offset(0.5, 0.5, 0.5);
        const dist = eyePos.distanceTo(placeCenter);
        if (dist > BLOCK_INTERACTION_RANGE || dist < MIN_PLACE_DIST) return;

        // 检查目标位置是否已被占用
        const existingBlock = bot.blockAt(placePos);
        if (existingBlock && existingBlock.name !== 'air' && !isReplaceableBlock(existingBlock)) {
            return;
        }

        await placeBlockWithTimeout(bot, refBlock, faceVector, PLACE_TIMEOUT_MS);
    }
}
