export default class SimpleAsyncMutex {
    private _lock;
    acquire(): Promise<() => void>;
    runExclusive<T>(callback: () => Promise<T> | T): Promise<T>;
}
//# sourceMappingURL=SimpleAsyncMutex.d.ts.map