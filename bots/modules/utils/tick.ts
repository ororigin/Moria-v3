import type { Bot } from 'mineflayer';

//每个 tick 的超时阈值

const PER_TICK_TIMEOUT_MS = 2000;

/**
 * tick 等待函数。
 *
 * @param bot    mineflayer Bot 实例
 * @param n      等待的 tick 数量
 * @param signal 可选的 AbortSignal，提前终止等待
 */
export async function waitForTicks(bot: Bot, n: number, signal?: AbortSignal): Promise<void> {
    for (let i = 0; i < n; i++) {
        if (signal?.aborted) return;
        await waitOneTick(bot, signal);
    }
}

async function waitOneTick(bot: Bot, signal?: AbortSignal): Promise<void> {
    const result = await Promise.race([
        bot.waitForTicks(1).then(() => 'tick' as const),
        timeout(PER_TICK_TIMEOUT_MS, signal).then(() => 'timeout' as const),
    ]);
    if (result === 'tick') return;
    while (!signal?.aborted) {
        await timeout(50, signal);
        return;
    }
}

function timeout(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener(
                'abort',
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                { once: true },
            );
        }
    });
}
