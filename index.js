import { app } from "./app.js";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
async function main() {
    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`🚀 Moria-v3 服务已启动: http://${HOST}:${PORT}`);
    }
    catch (err) {
        console.error("启动失败:", err);
        process.exit(1);
    }
}
main();
