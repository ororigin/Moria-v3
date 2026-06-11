export interface M2CProcessTransportData {
    type: string;
    [key: string]: any;
}
export interface C2MProcessTransportData {
    type: string;
    botId: string;
    timestamp: number;
    [key: string]: any;
}
export interface InternalData {
    type: string;
    message: Record<string, any>;
}
export declare function isM2CProcessTransportData(data: any): data is M2CProcessTransportData;
export declare function isC2MProcessTransportData(data: any): data is C2MProcessTransportData;
export declare function isInternalData(data: any): data is InternalData;
//# sourceMappingURL=transport.d.ts.map