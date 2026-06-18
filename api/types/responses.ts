/**
 * 统一 API 响应格式
 *
 * 所有 API 端点统一返回 ApiSuccess 或 ApiError 格式。
 * 使用 success() / error() 工厂函数构建响应。
 */

// ─── 成功响应 ────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

// ─── 错误响应 ────────────────────────────────────────────────────────────

export interface ApiError {
  success: false;
  error: {
    /** 机器可读的错误码，如 "BOT_NOT_FOUND"、"INVALID_PARAMS" */
    code: string;
    /** 人类可读的错误描述 */
    message: string;
  };
  timestamp: string;
}

// ─── 联合类型 ────────────────────────────────────────────────────────────

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── 工厂函数 ────────────────────────────────────────────────────────────

/** 构造成功响应 */
export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

/** 构造错误响应 */
export function error(code: string, message: string): ApiError {
  return { success: false, error: { code, message }, timestamp: new Date().toISOString() };
}
