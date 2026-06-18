export default class SimpleAsyncMutex {
    private _lock: Promise<void> = Promise.resolve();

    async acquire(): Promise<() => void> {
        let release: () => void;
        const newLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        await this._lock;
        this._lock = newLock;
        return release!;
    }

    async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
        const release = await this.acquire();
        try {
            return await callback();
        } finally {
            release();
        }
    }
}
