// 🚨 此文件为 type/transport.ts 的副本，必须保持同步！
// 修改根目录的 type/transport.ts 后请同步更新此文件。

// 主进程 → 子进程 传输数据格式
export interface M2CProcessTransportData {
    type: string;
    [key: string]: any;
}

// 子进程 → 主进程传输数据格式
export interface C2MProcessTransportData {
    type: string;
    botId: string;
    timestamp: number;
    [key: string]: any;
}

// 内部数据包格式
export interface InternalData {
    type: string;
    message: Record<string, any>;
}

// 类型守卫：判断数据是否为有效的 M2CProcessTransportData
export function isM2CProcessTransportData(data: any): data is M2CProcessTransportData {
    return data && typeof data === 'object' && typeof data.type === 'string';
}

// 类型守卫：判断数据是否为有效的 C2MProcessTransportData
export function isC2MProcessTransportData(data: any): data is C2MProcessTransportData {
    return (
        data &&
        typeof data === 'object' &&
        typeof data.type === 'string' &&
        typeof data.botId === 'string' &&
        typeof data.timestamp === 'number'
    );
}

// 类型守卫：判断数据是否为有效的 InternalData
export function isInternalData(data: any): data is InternalData {
    return (
        data &&
        typeof data === 'object' &&
        typeof data.type === 'string' &&
        typeof data.message === 'object' &&
        data.message !== null
    );
}

// ── Action 参数模板与描述 ──

/** 单个参数描述 */
export interface ActionParamDescriptor {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    description: string;
    default?: string | number | boolean;
}

/** Action 命令完整描述 */
export interface ActionDescriptor {
    action: string;
    commandName: string;
    description: string;
    params: ActionParamDescriptor[];
}
