export default class SimpleAsyncMutex {
    _lock = Promise.resolve();
    async acquire() {
        let release;
        const newLock = new Promise((resolve) => {
            release = resolve;
        });
        await this._lock;
        this._lock = newLock;
        return release;
    }
    async runExclusive(callback) {
        const release = await this.acquire();
        try {
            return await callback();
        }
        finally {
            release();
        }
    }
}
