/**
 * 内置配置类型枚举
 *
 * 如需扩展新配置类型，在此添加枚举值，
 * 并在 ConfigManagerFactory.TEMPLATE_MAP 中注册对应的模板工厂
 */
export var ConfigType;
(function (ConfigType) {
    /** 系统级配置 */
    ConfigType["SYSTEM"] = "system";
    /** Bot 实例配置 */
    ConfigType["BOT"] = "bot";
})(ConfigType || (ConfigType = {}));
//# sourceMappingURL=ConfigType.js.map