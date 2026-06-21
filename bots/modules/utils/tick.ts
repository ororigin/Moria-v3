import type { Bot } from 'mineflayer';

/**
 * 每个 tick 的超时阈值（毫秒）。
 * mineflayer 内部 physics tick 超时为 5050ms，我们在此前先 fallback
 */
const PER_TICK_TIMEOUT_MS = 2000;

/**
 * 健壮的 tick 等待函数。
 *
 * 优先使用 mineflayer 的 waitForTicks，若物理 tick 未及时触发则回退到
 * JavaScript setTimeout，避免因服务器不频繁推送位置更新导致的超时崩溃。
 *
 * @param bot    mineflayer Bot 实例
 * @param n      等待的 tick 数量
 * @param signal 可选的 AbortSignal，提前终止等待
 */
export async function waitForTicks(
    bot: Bot,
    n: number,
    signal?: AbortSignal,
): Promise<void> {
    for (let i = 0; i < n; i++) {
        if (signal?.aborted) return;
        await waitOneTick(bot, signal);
    }
}

async function waitOneTick(bot: Bot, signal?: AbortSignal): Promise<void> {
    // 竞速：waitForTicks(1) vs 自定义超时
    const result = await Promise.race([
        bot.waitForTicks(1).then(() => 'tick' as const),
        timeout(PER_TICK_TIMEOUT_MS, signal).then(() => 'timeout' as const),
    ]);

    // 如果 waitForTicks 先完成，正常返回
    if (result === 'tick') return;

    // 超时回退：使用 setTimeout 模拟 ~1 tick（50ms），每 50ms 检查一次 signal
    while (!signal?.aborted) {
        await timeout(50, signal);
        return; // 只等一个近似 tick 就返回
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
