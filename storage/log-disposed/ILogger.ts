export interface ILogger{
    //显式打开日志
    startLog(uuid:string) :void
    //显式关闭日志
    endLog(uuid:string) : void
    //写入日志
    log(uuid:string,type:string,message:string) : void
    //读取日志
    read(uuid:string,type:string) :string[]
    //安全关闭日志模块
    dispose() :void
}