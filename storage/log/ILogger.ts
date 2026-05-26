export default interface ILogger{
    //读取日志
    read(uuid:string,type:string,lineAmount:number) : Promise<string[]>;
    //写入日志
    log(uuid:string,type:string,message:string) : Promise<boolean>;
}