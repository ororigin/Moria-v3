/**
 * Bot 相关的 API 请求/响应类型
 */

/** POST /api/bots 请求体 */
export interface CreateBotRequest {
  /** Minecraft 用户名 */
  name: string;
  /** 服务器地址 */
  server: string;
  /** 服务器端口 */
  port: number;
  /** 服务器密码（可选） */
  password?: string;
}
