export type LogLevel = "debug" | "info" | "warn" | "error";

export default interface ILogger{
    //读取日志
    read(uuid:string,type:string,lineAmount:number) : Promise<string[]>;
    //写入日志
    log(uuid:string,type:string,message:string) : Promise<boolean>;
    //系统日志(按级别)
    sysLog(level:LogLevel,module:string,message:string): Promise<boolean>;
    //动态设置日志级别
    setLogLevel(level:LogLevel): void;
}