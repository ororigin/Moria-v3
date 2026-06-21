import { Vec3 } from 'vec3';

/**
 * 构建搜索用 AABB。
 * 对应 source.getBoundingBox().expandTowards(direction * maxDistance).inflate(inflate)
 */
export function expandAABB(
    origin: Vec3,
    direction: Vec3,
    distance: number,
    inflate: number,
): { min: Vec3; max: Vec3 } {
    const end = origin.plus(direction.scaled(distance));
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
 * 快速过滤：检查实体的 AABB 是否与搜索 AABB 相交
 */
export function aabbInSearchBox(
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
export function rayAABBIntersect(
    from: Vec3,
    to: Vec3,
    bb: { min: Vec3; max: Vec3 },
): number | null {
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
