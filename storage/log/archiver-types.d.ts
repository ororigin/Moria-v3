// archiver v8 类型声明（@types/archiver 仍为旧版 v5/v6 API）
declare module "archiver" {
    import { Transform, TransformOptions } from "stream";
    import { ZlibOptions } from "zlib";

    interface ArchiverOptions {
        zlib?: ZlibOptions | undefined;
        comment?: string | undefined;
        forceLocalTime?: boolean | undefined;
        forceZip64?: boolean | undefined;
        store?: boolean | undefined;
    }

    interface EntryData {
        name: string;
        date?: Date | string | undefined;
        mode?: number | undefined;
        prefix?: string | undefined;
        stats?: import("fs").Stats | undefined;
    }

    class Archiver extends Transform {
        constructor(options?: ArchiverOptions);
        file(filename: string, data: EntryData): this;
        append(source: import("stream").Readable | Buffer | string, data?: EntryData): this;
        directory(dirpath: string, destpath: false | string): this;
        finalize(): Promise<void>;
        pointer(): number;
    }

    export class ZipArchive extends Archiver {
        constructor(options?: ArchiverOptions);
    }

    export class TarArchive extends Archiver {
        constructor(options?: ArchiverOptions & { gzip?: boolean; gzipOptions?: ZlibOptions });
    }
}
