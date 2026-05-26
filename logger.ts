interface Logger{
    log(type : string , info : string) : void;
}

class SimpleLogger implements Logger{
    log(type : string ,info : string){
        console.log("["+type+"]"+info)
    }
}

class LoggerFactory{
    getLogFactory() : Logger{
        return new SimpleLogger;
    }
}