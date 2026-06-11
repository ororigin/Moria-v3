import fs from "fs/promises";
import fss from "fs";
import dayjs from "dayjs";
import envPaths from 'env-paths';
import path from "path";
import archiver from "archiver";
export default class Logger {
    __BASEDIR = envPaths("mc-moriabot-v3");
    __LOGPATH = this.__BASEDIR.log;
    __MAX_READ_BYTES;
    __mutex = Promise.resolve(); // 互斥锁
    constructor(maxReadBytes) {
        this.__MAX_READ_BYTES = maxReadBytes;
        this.rotateLog().catch(err => {
            console.error("[LOGGER] 构造期间轮转日志失败:", err);
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
            await fs.appendFile(filePath, message + "\n", "utf-8");
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
            console.error(`[LOGGER] 轮转日志失败:`, err);
        }
        finally {
            release();
        }
    }
}
