import type { ILogger } from "./ILogger.js";
import fs from "node:fs";
import dayjs from "dayjs";

interface LogStream{
    [uuid:string]:fs.WriteStream
}

export class Logger implements ILogger{

    logStreamList:LogStream;

    constructor(){
        this.logStreamList={}
    }

    startLog(uuid: string): void {
        if(this.logStreamList[uuid]!=undefined) return;
        const currentTime=Date.now();
        const chatFileName=`${uuid}-chat-${currentTime}.log`;
        const chatWriteStream=fs.createWriteStream(chatFileName);
        const logFileName=`${uuid}-log-${currentTime}.log`;
        const logWriteStream=fs.createWriteStream(logFileName);
        this.logStreamList[uuid]=chatWriteStream
    }
    endLog(uuid: string): void {
        
        
    }

    log(uuid: string, type: string, message: string): void {
        
    }

    read(uuid: string, type: string): string[] {
        return [];
    }
    
    dispose(): void {
        
    }
}