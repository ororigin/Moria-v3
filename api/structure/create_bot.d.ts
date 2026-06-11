interface CreateBotRequest {
    name: string;
    server: string;
    port: number;
    password: string;
}
interface CreateBotResponse {
    success: boolean;
    message: string;
    bot_id: string;
}
export type { CreateBotRequest, CreateBotResponse };
//# sourceMappingURL=create_bot.d.ts.map