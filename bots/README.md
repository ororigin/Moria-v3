# Moria-v3 项目文档

## 项目概述

**项目名称**: Moria-v3  
**版本**: 1.0.0  
**描述**: 一个基于 Mineflayer 的 Minecraft 机器人框架，支持命令调度、事件处理和多种内置命令

---

## 项目结构

```
Moria-v3/
├── index.ts                    # 项目入口点（当前为空）
├── logger.ts                   # 日志工厂类
├── package.json               # 项目配置文件
├── tsconfig.json              # TypeScript 编译配置
└── bots/                       # 机器人核心模块
    ├── bot.ts                 # 机器人主入口
    ├── core/                  # 核心功能模块
    │   ├── BotManager.ts      # 机器人生命周期管理
    │   └── CommandDispatcher.ts # 命令调度器
    ├── modules/               # 功能模块
    │   ├── Commands.ts        # 命令基类和处理器
    │   ├── CommandResolver.ts # 命令解析器
    │   └── commands/          # 内置命令集合
    │       ├── index.ts       # 命令导出和描述
    │       ├── SayCommand.ts      # 聊天命令
    │       ├── TpaCommand.ts      # 传送请求命令
    │       ├── MountMinecartCommand.ts    # 上矿车命令
    │       ├── DismountCommand.ts         # 下矿车命令
    │       ├── UseCommandCommand.ts       # 执行命令
    │       └── HelpCommand.ts    # 帮助命令
    └── utils/
        └── IContext.ts        # 上下文接口定义
```

---

## 核心组件

### 1. BotManager (`bots/core/BotManager.ts`)

**职责**: 管理机器人的生命周期、连接状态和重新连接逻辑

**主要功能**:
- 创建和初始化 Mineflayer Bot 实例
- 处理连接事件（spawn、end、kicked、error）
- 自动重连机制（最多 5 次）
- 监听游戏内私聊并触发命令解析
- 优雅关闭机制

**关键配置**:
- `max_reconnect` / `maxReconnect`: 最大重连上限，默认 `5`
- `auto_reconnect` / `autoReconnect`: 是否自动重连，默认 `true`（设为 `false` 则断线后进程不再尝试重连并退出）
- `reconnect_interval` / `reconnectInterval`: 重连间隔（毫秒），默认 `5000`（即 5 秒）

### 2. CommandDispatcher (`bots/core/CommandDispatcher.ts`)

**职责**: 命令调度和分发

**主要功能**:
- 将命令添加到处理队列
- 清空队列和中止当前命令

### 3. CommandResolver (`bots/modules/CommandResolver.ts`)

**职责**: 解析不同来源的命令输入

**支持的解析方式**:
- **游戏内私聊**: 以 `#` 开头的消息
- **标准输入 (stdin)**: JSON 格式的命令对象

### 4. CommandHandler (`bots/modules/Commands.ts`)

**职责**: 命令队列管理和执行

**主要功能**:
- 维护命令队列
- 顺序执行命令
- 处理独占型命令的中断
- 警告处理机制

---

## 命令系统

### 命令架构

```
Command (抽象基类)
├── exec(context, signal)      # 执行命令
└── sender: string             # 命令发送者

PersistentCommand              # 独占型命令
└── 执行期间阻止其他命令

TerminateCommand               # 终止命令
└── 用于中止当前运行的命令
```

### 内置命令列表

| 命令 | 用法 | 描述 |
|------|------|------|
| `say` | `#say [内容]` | 发送聊天信息 |
| `tpme` | `#tpme` | 向执行者发送 TPA 请求 |
| `minecart` | `#minecart` | 乘坐周围最近的矿车 |
| `dismount` | `#dismount` | 停止骑乘 |
| `usecommand` | `#usecommand [命令]` | 执行游戏命令（不需要 `/`） |
| `help` | `#help [命令名]` | 显示帮助信息 |
| `taskkill` | `#taskkill` | 中止当前任务 |

### 命令输入来源

#### 来源 1: 游戏内私聊
```
格式: #命令 参数1 参数2 ...
示例: #say Hello World
```

#### 来源 2: 标准输入 (JSON)
```json
{
  "type": "chat",
  "msg": "要发送的消息"
}
```

```json
{
  "type": "action",
  "index": "1"  // 1: mount minecart, 2: dismount
}
```

```json
{
  "type": "stop"
}
```

---

## 上下文接口

### IContext (`bots/utils/IContext.ts`)

```typescript
interface IContext {
  bot: Bot | null;           // Mineflayer Bot 实例
  config: {
    botId: string;           // 机器人 ID
    name: string;            // 机器人游戏名称
    host: string;            // 服务器地址
    port: number;            // 服务器端口
    password: string;        // 服务器密码
    // 可选重连配置：
    // - `max_reconnect` / `maxReconnect`: 最大重连次数（默认 5）
    // - `auto_reconnect` / `autoReconnect`: 是否自动重连（默认 true）
    // - `reconnect_interval` / `reconnectInterval`: 重连间隔，单位毫秒（默认 5000）
  };
  getBot(): Bot;            // 获取 Bot 实例的方法
}
```

---

## 启动方式

### 命令行参数

```bash
node dist/bot.js <botId> <name> <host> <port> [password]
```

**参数说明**:
- `botId`: 机器人唯一标识符
- `name`: 机器人在 Minecraft 中的用户名
- `host`: Minecraft 服务器地址
- `port`: Minecraft 服务器端口
- `password`: 服务器密码（可选，默认为 `ufdbfcir`）

**示例**:
```bash
node dist/bot.js bot1 MyBot localhost 25565 mypassword
```

### 开发运行

```bash
npm run dev
```

### 编译构建

```bash
npm run build
```

### 生产运行

```bash
npm start
```

---

## 信号处理

机器人支持以下系统信号：

| 信号 | 行为 |
|------|------|
| `SIGTERM` | 正常关闭机器人 |
| `SIGINT` | 正常关闭机器人（Ctrl+C） |
| stdin 关闭 | 正常关闭机器人 |

---

## 输出格式

机器人通过 `stdout` 输出 JSON 格式的消息：

```json
{
  "type": "log",
  "botId": "bot1",
  "message": "信息内容",
  "timestamp": 1700000000000
}
```

```json
{
  "type": "status",
  "botId": "bot1",
  "status": "online|offline",
  "timestamp": 1700000000000
}
```

---

## 依赖项

### 生产依赖
- **mineflayer**: Minecraft 机器人客户端库

### 开发依赖
- **typescript**: ^6.0.2 - TypeScript 编译器
- **ts-node**: ^10.9.2 - TypeScript 执行器

---

## 日志系统

### Logger 工厂 (`logger.ts`)

**类结构**:
```typescript
interface Logger {
  log(type: string, info: string): void;
}

class SimpleLogger implements Logger {
  log(type: string, info: string): void {
    console.log("[" + type + "]" + info);
  }
}

class LoggerFactory {
  getLogFactory(): Logger { /* ... */ }
}
```

---

## 警告处理

系统定义了两类警告：

| 警告代码 | 描述 |
|---------|------|
| `0` | 命令因阻塞被忽略（机器人正在执行其他任务） |
| `1` | 中止命令无效（当前没有正在运行的命令） |

---

## 自动功能

### 自动注册/登录
机器人会自动监听服务器的注册/登录提示，并发送相应的命令：
- `/reg [密码] [邮箱]` - 自动注册
- `/l [密码]` - 自动登录

---

## 错误处理

### 连接错误处理流程
1. 检测到连接错误
2. 记录错误信息
3. 清空命令队列
4. 设置离线状态
5. 根据配置判断是否自动重连：若 `auto_reconnect` 为 `false` 则直接退出
6. 若启用自动重连且未达到 `max_reconnect`，在 `reconnect_interval` 毫秒后重连
7. 达到最大重连次数后，进程退出

### 命令执行错误
- 若命令解析失败，输出错误日志并继续处理下一条命令
- 若命令执行异常，会捕获并记录

---

## 工作流程

```
启动
  ↓
初始化 BotManager
  ↓
创建 Mineflayer Bot
  ↓
监听输入（游戏私聊 & stdin）
  ↓
CommandResolver 解析命令
  ↓
CommandDispatcher 调度命令
  ↓
CommandHandler 顺序执行
  ↓
输出结果到 stdout
  ↓
监听系统信号（SIGINT/SIGTERM）
  ↓
优雅关闭
```

---

## 开发规范

### 添加新命令

1. 在 `bots/modules/commands/` 中创建新文件
2. 继承 `Command` 类（或 `PersistentCommand`）
3. 实现 `exec(context, signal)` 方法
4. 在 `CommandResolver.resolveInGame()` 或 `resolveStdin()` 中注册
5. 在 `commands/index.ts` 中导出并添加描述

**示例**:
```typescript
export class MyCommand extends Command {
  async exec(context: IContext, signal?: AbortSignal): Promise<void> {
    const bot = context.getBot();
    // 实现命令逻辑
  }
}
```

---

## 故障排查

### Bot 无法连接
- 检查 `host` 和 `port` 配置是否正确
- 检查服务器是否在线
- 检查密码是否正确

### 命令未执行
- 检查命令格式是否正确（以 `#` 开头）
- 检查发送者是否有权限
- 查看日志输出确认是否有警告（代码 0 表示被阻塞）

### 频繁重连
- 检查服务器稳定性
- 查看 `BotManager` 的日志输出
- 检查网络连接

---

## 许可证

ISC License

---

## 作者

本文档生成于 2026 年 4 月 15 日
