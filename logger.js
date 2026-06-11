class SimpleLogger {
    log(type, info) {
        console.log("[" + type + "]" + info);
    }
}
class LoggerFactory {
    getLogFactory() {
        return new SimpleLogger;
    }
}
export {};
//# sourceMappingURL=logger.js.map