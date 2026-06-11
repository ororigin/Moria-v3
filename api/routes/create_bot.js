export default async function createBotRoute(fastify, options) {
    fastify.post("/create_bot", async (request, reply) => {
        const { name, server, port, password } = request.body;
    });
}
//# sourceMappingURL=create_bot.js.map