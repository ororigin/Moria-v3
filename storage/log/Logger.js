import fs from "fs/promises";
import fss from "fs";
import dayjs from "dayjs";
import envPaths from 'env-paths';
import path from "path";
import archiver from "archiver";
export default class Logger {
    __BASEDIR = envPaths("mc-moriabot-v3");
    __LOGPATH = this.__BASEDIR.log;
    __SYSLOG_PATH = path.join(this.__BASEDIR.log, "system");
    __MAX_READ_BYTES;
    __logLevel;
    __mutex = Promise.resolve(); // 互斥锁
    __LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
    constructor(maxReadBytes, logLevel = "info") {
        this.__MAX_READ_BYTES = maxReadBytes;
        this.__logLevel = logLevel;
        this.rotateLog().catch(async (err) => {
            await this.sysLog("error", "Logger", `构造期间轮转日志失败: ${err}`);
        });
    }
    async log(uuid, type, message) {
        const safeMessage = message.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        const fileName = `${uuid}-${type}.log`;
        const filePath = path.join(this.__LOGPATH, fileName);
        const release = await this.lock(); // 获取锁
        const messages = `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}]${safeMessage}`;
        try {
            console.log(message);
            await this.ensureDir();
            await fs.appendFile(filePath, messages + "\n", "utf-8");
            return true;
        }
        catch (error) {
            console.error("[LOGGER]写入日志失败。");
            console.error(`[LOGGER]---错误信息---\n${error}\n--------------`);
            return false;
        }
        finally {
            release(); // 释放锁
        }
    }
    async read(uuid, type, lineAmount) {
        const fileName = `${uuid}-${type}.log`;
        const filePath = path.join(this.__LOGPATH, fileName);
        await this.ensureDir();
        if (!await this.isFileExist(filePath)) {
            return [];
        }
        const fileStats = await fs.stat(filePath);
        try {
            if (fileStats.size <= this.__MAX_READ_BYTES) {
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split(/\r?\n/);
                return lines.slice(-lineAmount);
            }
            const startReadByte = fileStats.size - this.__MAX_READ_BYTES;
            const readBuffer = Buffer.alloc(this.__MAX_READ_BYTES);
            const file = await fs.open(filePath, "r");
            try {
                const { bytesRead } = await file.read(readBuffer, 0, this.__MAX_READ_BYTES, startReadByte);
                const content = readBuffer.subarray(0, bytesRead).toString("utf-8");
                const lines = content.split(/\r?\n/);
                return lines.slice(1, lines.length).slice(-lineAmount);
            }
            finally {
                await file.close();
            }
        }
        catch (error) {
            console.error("[LOGGER]读取日志失败。");
            console.error(`[LOGGER]---错误信息---\n${error}\n--------------`);
            return [];
        }
    }
    async lock() {
        let release;
        const prev = this.__mutex;
        this.__mutex = new Promise(res => { release = res; });
        await prev;
        return release;
    }
    async isFileExist(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async ensureDir() {
        try {
            await fs.mkdir(this.__LOGPATH, { recursive: true });
        }
        catch { }
    }
    async rotateLog() {
        const release = await this.lock();
        try {
            await this.ensureDir();
            const files = await fs.readdir(this.__LOGPATH, { withFileTypes: true });
            const groupMap = new Map();
            const existingArchives = new Set();
            for (const dirent of files) {
                const name = dirent.name;
                if (name.endsWith(".log")) {
                    const base = name.slice(0, -4);
                    const arr = groupMap.get(base) || [];
                    arr.push(dirent);
                    groupMap.set(base, arr);
                }
                else if (name.endsWith(".zip")) {
                    const base = name.slice(0, -4);
                    existingArchives.add(base);
                }
            }
            for (const [baseName, logFiles] of groupMap) {
                if (logFiles.length === 0)
                    continue;
                let archiveBase = baseName;
                let counter = 0;
                while (existingArchives.has(archiveBase)) {
                    counter++;
                    archiveBase = `${baseName}-${counter}`;
                }
                const archiveFileName = `${archiveBase}.zip`;
                const archivePath = path.join(this.__LOGPATH, archiveFileName);
                await new Promise((resolve, reject) => {
                    const output = fss.createWriteStream(archivePath);
                    const arch = archiver("zip", { zlib: { level: 9 } });
                    output.on('close', resolve);
                    arch.on('error', reject);
                    arch.pipe(output);
                    for (const logFile of logFiles) {
                        const filePath = path.join(this.__LOGPATH, logFile.name);
                        arch.file(filePath, { name: logFile.name });
                    }
                    arch.finalize();
                });
                for (const logFile of logFiles) {
                    await fs.unlink(path.join(this.__LOGPATH, logFile.name));
                }
                existingArchives.add(archiveBase);
            }
        }
        catch (err) {
            await this.sysLog("error", "Logger", `轮转日志失败: ${err}`);
        }
        finally {
            release();
        }
    }
    // 系统日志
    async sysLog(level, module, message) {
        // 级别过滤：低于当前配置级别的不记录
        if (this.__LEVEL_PRIORITY[level] < this.__LEVEL_PRIORITY[this.__logLevel]) {
            return true;
        }
        const safeMessage = message.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        const filePath = path.join(this.__SYSLOG_PATH, "system.log");
        const release = await this.lock();
        const line = `[${dayjs().format("YYYY-MM-DD HH:mm:ss")}][${level.toUpperCase()}][${module}]${safeMessage}`;
        try {
            // 控制台输出（映射到对应 console 方法）
            switch (level) {
                case "debug":
                    console.debug(line);
                    break;
                case "info":
                    console.info(line);
                    break;
                case "warn":
                    console.warn(line);
                    break;
                case "error":
                    console.error(line);
                    break;
            }
            await this.ensureSysDir();
            await fs.appendFile(filePath, line + "\n", "utf-8");
            return true;
        }
        catch (error) {
            console.error(`[LOGGER] 系统日志写入失败:`, error);
            return false;
        }
        finally {
            release();
        }
    }
    setLogLevel(level) {
        this.__logLevel = level;
    }
    async ensureSysDir() {
        try {
            await fs.mkdir(this.__SYSLOG_PATH, { recursive: true });
        }
        catch { }
    }
}
