import { exec, type ChildProcess } from "child_process";
import { promisify } from "util";
import os from "os";

const execPromise = promisify(exec);

/**
 * 以 setImmediate 轮询等待子进程退出，最多等待 timeoutMs 毫秒
 */
export function waitForExit(
    child: ChildProcess,
    timeoutMs: number,
): Promise<void> {
    return new Promise<void>((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const poll = () => {
            if (child.killed || child.exitCode !== null) {
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                resolve();
                return;
            }
            setImmediate(poll);
        };
        poll();
    });
}

/**
 * 判断子进程是否仍在运行（同时也是 ChildProcess 的类型守卫）
 */
export function isProcessAlive(
    child: ChildProcess | null | undefined,
): child is ChildProcess {
    return !!child && !child.killed && child.exitCode === null;
}

/**
 * 强制终止进程（三级安全网）
 * 1. 发送 SIGTERM 信号尝试优雅关闭
 * 2. 等待 gracePeriodMs 毫秒
 * 3. 若仍未退出则强杀（Windows: taskkill /F /T, Linux: SIGKILL）
 */
export async function forceKillProcess(
    child: ChildProcess,
    pid: number,
    gracePeriodMs: number = 5000,
): Promise<void> {
    if (!isProcessAlive(child)) return;

    // 1. SIGTERM
    try {
        child.kill("SIGTERM");
    } catch {
        // Windows 上忽略信号错误
    }

    // 2. 等待进程退出
    await waitForExit(child, gracePeriodMs);

    // 3. 若仍未退出则强杀
    if (!isProcessAlive(child)) return;

    if (os.platform() === "win32") {
        try {
            await execPromise(`taskkill /F /T /PID ${pid}`);
        } catch {
            // 忽略 taskkill 错误
        }
    } else {
        try {
            child.kill("SIGKILL");
        } catch {
            // 忽略错误
        }
    }
}

export { execPromise };
