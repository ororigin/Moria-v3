export default interface ILogger {
    read(uuid: string, type: string, lineAmount: number): Promise<string[]>;
    log(uuid: string, type: string, message: string): Promise<boolean>;
}
//# sourceMappingURL=ILogger.d.ts.map