/**
 * 配置数据基接口
 * 所有配置类型必须继承此接口
 *
 * createdAt / updatedAt 由管理器自动维护
 */
export interface IConfig {
  /** 创建时间（ISO 8601） */
  createdAt: string;
  /** 最后更新时间（ISO 8601） */
  updatedAt: string;
}
