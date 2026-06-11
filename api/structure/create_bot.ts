interface CreateBotRequest {
    /** Minecraft 用户名 */
    name: string;
    /** 服务器地址 */
    server: string;
    /** 服务器端口 */
    port: number;
    /** 服务器密码 */
    password?: string;
}

interface CreateBotResponse {
    success: boolean;
    message: string;
    bot_id: string;
    configPath?: string;
}

export type { CreateBotRequest, CreateBotResponse };