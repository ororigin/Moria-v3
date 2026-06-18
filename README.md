# Moria-v3

> 基于 Mineflayer 的 Minecraft 机器人管理平台

Moria-v3 是一个使用 TypeScript 编写的 Minecraft Bot 管理服务器。它通过主进程管理多个 Mineflayer 机器人子进程，提供 RESTful API 进行远程控制、系统监控与日志管理。

---

## 目录

- [项目架构](#项目架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [配置](#配置)
- [API 文档](#api-文档)
- [Bot 子系统](#bot-子系统)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [迁移说明](#迁移说明)

---

## 项目架构



系统采用 **主进程 + Bot 子进程** 的多进程架构：

- **主进程** — Fastify HTTP 服务器，负责配置管理、日志、系统监控、Bot 生命周期管理
- **Bot 子进程** — 通过 `child_process.fork()` 启动，每个子进程运行一个 Mineflayer 机器人实例，通过 IPC 与主进程通信
- **通信方式** — IPC 通道（`fork` 模式下）或 Stdio 回退

---


## 快速开始

### 前置要求

- Node.js >= 20
- npm >= 9

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd Moria-v3

# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

### 启动

```bash
# 开发模式（ts-node 热加载）
npm run dev

# 生产模式
npm run build
npm start
```

启动后将监听 `0.0.0.0:3000`（默认端口，可在配置中修改）。

---

## 配置

配置文件位于 `configs/` 目录下，使用 JSON 格式存储。

### 系统配置

`configs/system/main_config.json`：

```json
{
  "version": "1.0.0",
  "logLevel": "info",
  "maxConnections": 100,
  "maintenanceMode": false,
  "allowedOrigins": ["http://localhost:3000"],
  "port": 3000
}
```

| 字段             | 类型      | 默认值                    | 说明                 |
| ---------------- | --------- | ------------------------- | -------------------- |
| `version`        | string    | `"1.0.0"`                 | 系统版本号           |
| `logLevel`       | string    | `"info"`                  | 日志级别             |
| `maxConnections` | number    | `100`                     | 最大连接数           |
| `maintenanceMode`| boolean   | `false`                   | 维护模式开关         |
| `allowedOrigins` | string[]  | `["http://localhost:3000"]` | 允许的跨域来源     |
| `port`           | number    | `3000`                    | HTTP 监听端口        |

### Bot 配置

每个 Bot 对应一个配置文件，存储在 `configs/bot/<botId>_config.json`：

| 字段                | 类型    | 默认值       | 说明                    |
| ------------------- | ------- | ------------ | ----------------------- |
| `botId`             | string  | —            | Bot 唯一标识符          |
| `name`              | string  | —            | Minecraft 用户名        |
| `host` / `server`   | string  | `"localhost"`| 服务器地址              |
| `port`              | number  | `25565`      | 服务器端口              |
| `password`          | string  | `12345678`            | 连接密码                |
| `autoReconnect`     | boolean | `true`       | 是否自动重连            |
| `maxReconnect`      | number  | `5`          | 最大重连次数            |
| `reconnectInterval` | number  | `5000`       | 重连间隔（毫秒）        |
| `commandPrefix`     | string  | `"#"`        | 命令前缀                |

配置文件在首次读取时会根据模板自动创建。

---

## API 文档

所有 API 返回统一的响应格式：

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "错误描述"
  }
}
```

### 健康检查

```
GET /api/health
```

返回服务器运行状态和版本信息。

### 系统信息

```
GET /api/system/info
```

返回 CPU 使用率、内存使用率、网络上传/下载速率（bps），保持 v2 版本的 `snake_case` 字段兼容。

### Bot 管理

| 方法     | 路径                    | 说明                 |
| -------- | ----------------------- | -------------------- |
| `POST`   | `/api/bots`             | 创建新 Bot           |
| `GET`    | `/api/bots`             | 获取所有 Bot 列表    |
| `GET`    | `/api/bots/online-count`| 获取在线 Bot 数量    |
| `GET`    | `/api/bots/total-count` | 获取 Bot 总数        |
| `GET`    | `/api/bots/:id`         | 获取单个 Bot 信息    |
| `GET`    | `/api/bots/:id/logs`    | 获取 Bot 日志        |
| `GET`    | `/api/bots/:id/chats`   | 获取 Bot 聊天记录    |
| `POST`   | `/api/bots/:id/start`   | 启动 Bot             |
| `POST`   | `/api/bots/:id/stop`    | 停止 Bot             |
| `POST`   | `/api/bots/:id/command` | 向 Bot 发送命令      |
| `POST`   | `/api/bots/:id/action`  | 让 Bot 执行动作      |
| `DELETE` | `/api/bots/:id`         | 删除 Bot             |

### 旧路径兼容

v2 版本的旧 API 路径通过 **308 永久重定向** 保持兼容，包括：

- `/health` → `/api/health`
- `/create_bot` → `/api/bots` (POST)
- `/bots` → `/api/bots`
- `/bot/:id` → `/api/bots/:id`
- `/online_count` → `/api/bots/online-count`
- `/total_count` → `/api/bots/total-count`

---

## Bot 子系统

Bot 子进程位于 `bots/` 目录下，是独立的 Mineflayer 客户端程序。

### 核心模块

| 模块                   | 说明                                 |
| ---------------------- | ------------------------------------ |
| `core/BotManager.ts`   | Bot 生命周期管理（连接、重连、事件绑定）|
| `core/CommandDispatcher.ts` | 命令调度器（队列管理、中断控制）    |
| `modules/Commands.ts`  | 命令基类与处理器                       |
| `modules/CommandResolver.ts` | 命令解析器                         |

### 内置命令

| 命令                            | 功能             |
| ------------------------------- | ---------------- |
| `SayCommand`                    | 发送聊天消息     |
| `TpaCommand`                    | 发送传送请求     |
| `MountMinecartCommand`          | 上矿车           |
| `DismountCommand`               | 下矿车           |
| `UseCommandCommand`             | 执行 Minecraft 指令 |
| `HelpCommand`                   | 显示帮助信息     |

### 进程间通信

主进程与 Bot 子进程之间通过 IPC 消息进行通信，支持以下消息类型：

| 消息类型          | 方向       | 说明                         |
| ----------------- | ---------- | ---------------------------- |
| `heartbeat`       | 双向       | 心跳检测与保活               |
| `status`          | 子→父      | 状态上报（starting/online/offline）|
| `init`            | 父→子      | 初始化配置下发               |
| `config:update`   | 子→父      | 配置变更上报                 |
| `chat`            | 子→父      | 游戏内聊天消息上报           |
| `log`             | 子→父      | 运行日志上报                 |
| `internal`        | 子→父      | 自定义内部事件               |

### Bot 启动方式

Bot 子进程可以通过两种方式启动：

1. **IPC 配置下发**（推荐）— 主进程通过 `fork()` 创建子进程，发送 `init` 消息提供完整配置
2. **命令行参数** — 直接运行 `node bot.js <botId> <name> <host> <port> [password]`

---

## 项目结构

```
Moria-v3/
├── index.ts                    # 主进程入口
├── app.ts                      # Fastify 应用工厂
├── package.json                # 项目依赖与脚本
├── tsconfig.json               # TypeScript 编译配置
│
├── api/                        # HTTP API 层
│   ├── index.ts                #   路由注册入口
│   ├── legacy/                 #   旧路径 308 重定向
│   ├── middlewares/             #   中间件
│   ├── routes/                 #   路由处理器
│   │   ├── health.ts           #     GET /api/health
│   │   ├── system.ts           #     GET /api/system/info
│   │   └── bot/                #     /api/bots/* 子路由
│   └── types/                  #   响应格式定义
│
├── bot_manager/                # Bot 进程管理
│   ├── BotManager.ts           #   主进程 Bot 管理器
│   ├── utils.ts                #   工具函数
│   └── type/                   #   类型定义
│
├── bots/                       # Bot 子进程（Mineflayer 客户端）
│   ├── bot.ts                  #   子进程入口
│   ├── core/                   #   核心模块
│   │   ├── BotManager.ts       #     Mineflayer Bot 管理器
│   │   └── CommandDispatcher.ts #     命令调度器
│   ├── modules/                #   功能模块
│   │   ├── Commands.ts         #     命令基类
│   │   ├── CommandResolver.ts  #     命令解析器
│   │   └── commands/           #     内置命令
│   ├── transports/             #   进程间通信层
│   │   ├── Transport.ts        #     抽象接口
│   │   ├── IpcTransport.ts     #     IPC 通信实现
│   │   └── StdioTransport.ts   #     Stdio 回退实现
│   ├── type/                   #   类型定义
│   └── utils/                  #   工具
│
├── configs/                    # 配置文件目录
│   └── system/
│       └── main_config.json    #   系统配置
│
├── storage/                    # 持久化存储
│   ├── config/                 #   配置系统
│   │   ├── interfaces/         #     接口定义
│   │   ├── managers/           #     配置管理器实现
│   │   ├── templates/          #     默认值模板
│   │   ├── types/              #     配置类型
│   │   ├── factory/            #     工厂模式
│   │   ├── utils/              #     校验工具
│   │   └── index.ts            #     统一导出
│   └── log/                    #   日志系统
│       ├── ILogger.ts          #     日志接口
│       └── Logger.ts           #     日志实现（自动归档）
│
├── system/                     # 系统级模块
│   └── monitor/                #   系统性能监控
│       ├── SystemMonitor.ts    #     实现
│       └── interfaces/         #     接口定义
│
├── type/                       # 通用类型
│   └── transport.ts            #   IPC 消息类型
│
└── utils/
    └── SimpleAsyncMutex.ts     #   异步互斥锁
```

---

## 开发指南

### 常用命令

```bash
npm run dev          # 开发模式（ts-node 直接运行）
npm run build        # 编译 TypeScript
npm run clean        # 清理构建产物
npm run rebuild      # 清理并重新编译
npm run build:bots   # 编译 Bot 子进程
npm start            # 生产模式启动
```

### 编译输出

- 主进程编译到 `dist/` 目录
- Bot 子进程编译到 `bots/dist/` 目录

### 特性

- 所有 import 使用 `.js` 扩展名（TypeScript nodenext 模块解析要求）
- 使用 `verbatimModuleSyntax`，类型导入需使用 `import type`
- 配置系统采用懒加载 + 深度合并策略
- 日志系统使用即时文件打开方式，不维护文件流以节省内存

---

## 迁移说明

本项目是 v2 的完整 TypeScript 重构，主要变化：

| 方面         | v2                     | v3                |
| ------------ | ------------------------------ | ----------------------------- |
| 语言         | Python + Flask                 | TypeScript + Fastify          |
| 机器人库     | 自定义 process-based           | Mineflayer 4                  |
| 配置         | 硬编码 / 全局变量              | 接口驱动 JSON 配置系统        |
| 日志         | 简单的文件写入                 | 带归档、级别过滤的日志系统    |
| 系统监控     | psutil                         | `os` 模块 + `systeminformation` |
| 进程管理     | subprocess.Popen               | child_process.fork + IPC      |
| API 风格     | 混合路径                       | 统一 RESTful + 旧路径 308 重定向 |

---

## 许可证

ISC


