// ============================================================
// 🚨 如果修改此文件，请同步更新 bots/type/transport.ts
// 两者内容必须保持一致（分属不同编译上下文）
// ============================================================
//类型守卫：判断数据是否为有效的 M2CProcessTransportData
export function isM2CProcessTransportData(data) {
    return data && typeof data === 'object' && typeof data.type === 'string';
}
//类型守卫：判断数据是否为有效的 C2MProcessTransportData
export function isC2MProcessTransportData(data) {
    return (data &&
        typeof data === 'object' &&
        typeof data.type === 'string' &&
        typeof data.botId === 'string' &&
        typeof data.timestamp === 'number');
}
//类型守卫：判断数据是否为有效的 InternalData
export function isInternalData(data) {
    return (data &&
        typeof data === 'object' &&
        typeof data.type === 'string' &&
        typeof data.message === 'object' && data.message !== null);
}
