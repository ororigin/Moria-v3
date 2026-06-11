import type ILogger from "./ILogger.js";
export default class Logger implements ILogger {
    private __BASEDIR;
    private __LOGPATH;
    private __MAX_READ_BYTES;
    private __mutex;
    constructor(maxReadBytes: number);
    log(uuid: string, type: string, message: string): Promise<boolean>;
    read(uuid: string, type: string, lineAmount: number): Promise<string[]>;
    private lock;
    private isFileExist;
    private ensureDir;
    private rotateLog;
}
//# sourceMappingURL=Logger.d.ts.map