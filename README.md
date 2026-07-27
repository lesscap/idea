# idea

面向业务同学的软件创作平台。不懂技术的人把需求讲清楚，在 agent 引导下产出正确的需求，进而构建企业内使用的软件。

当前状态：**骨架**。目录结构、工具链、运行链路已搭通并验证，尚无业务功能。

## 起步

```bash
pnpm install                      # 装依赖，并自动跑 prisma generate

cp .env.example web-packages/core/.env      # prisma CLI 读它
cp .env.example web-packages/server/.env    # server 运行时读它
cp .env.example web-packages/worker/.env    # worker 读它
# 三个 .env 里的 DATABASE_URL 换成真实开发库地址（不在仓库里，问团队要）

pnpm dev                          # 并行起 server 与 web
```

打开 http://localhost:5300 ，页面显示服务与数据库状态即为正常。

单独启动：

```bash
pnpm --filter @idea/server dev
pnpm --filter @idea/web    dev
pnpm --filter @idea/worker dev
```

常用命令：

```bash
pnpm typecheck        # 各包 tsc --noEmit
pnpm test             # 各包 vitest
pnpm lint             # biome lint
pnpm check            # 格式化 + typecheck + test，提交前跑这个
pnpm db:generate      # 重新生成 prisma client
pnpm db:migrate       # 建 migration
```

| 服务 | 端口 |
|---|---|
| server（Hono API） | 3300 |
| web（Vite dev） | 5300 |

前端通过 `/api` 前缀访问后端，Vite 代理时会把前缀去掉——后端路由挂在根上（`/health`，不是 `/api/health`）。生产环境由反向代理承担同样的角色。

> **本地坑**：如果你的 shell 设了 `http_proxy` / `https_proxy`，curl 打 localhost 会被代理劫持成 502。验证时加 `--noproxy '*'`：
> ```bash
> curl -s --noproxy '*' http://localhost:3300/health
> ```

数据库默认用团队共享的远端开发库。想完全离线开发，仓库里有 `docker-compose.yml` 起本地 Postgres 17，把 `DATABASE_URL` 换成 `.env.example` 里的 localhost 那条即可。

## 包结构

按**运行目标**分组，不按层分组。

```
packages/shared/        @idea/shared   跨运行时契约：ApiResponse 信封、Id
web-packages/core/      @idea/core     后端内核：Prisma schema/client、资源接线原语
web-packages/server/    @idea/server   Hono API
web-packages/worker/    @idea/worker   agent worker 常驻进程
ui-packages/design/     @idea/design   纯 UI：design token + 基础组件
ui-packages/web/        @idea/web      React SPA
```

依赖方向是单向的，靠约定维持（没有工具强制，但下面两条边是有意为之，改动前先读理由）：

```
shared ← core ← server
shared ← core ← (未来的 tasks / 定时任务)
shared ← worker              ← 不依赖 core
design ← web                 ← 只依赖 react
shared ← web
```

**worker 不依赖 core，拿不到数据库凭据。** 这不是遗漏。worker 未来可能跑在机房外的机器上，把库凭据发出去是错的。它只通过 HTTP 跟 server 对话。要加数据访问时，先问为什么不能走 API。

**design 不依赖 shared，不认识任何领域类型。** 组件层一旦沾上传输契约，后端契约一变就震到组件层，而且这个包立刻失去复用可能。需要结构化数据的组件，由调用方把数据拆成基础 props 传进来。

## worker 进程模型

**一台机器一个守护进程**，按能力注册、跨项目复用。

worker 注册的是它**能做什么**（`WORKER_CAPABILITIES`），不是它属于哪个项目。服务端按能力匹配在线 worker 并推送任务，项目标识随每条命令传递。连接是**只出不进**的长连接——worker 不需要入站端口，可以跑在 NAT 后面的任意机器上。

并发靠**槽位**，不靠进程：一个守护进程内并发多个会话，有上限计数。

> 参考实现 baton 是一个项目一个守护进程，因为它的 agent 要在 git worktree 里改代码，项目↔仓库 1:1 逼出了 worker↔项目 1:1。我们的 agent 做需求澄清、不 checkout 代码，这个约束不存在，所以不继承那个进程模型。
>
> **代价**：单进程同时持有多个项目的上下文，崩溃或串号会跨项目边界，多进程模型天然没这个问题。企业内部平台可接受。真需要隔离时，在同一台机器上跑多个 worker、各自声明不相交的能力集即可，模型本身支持。

## 约定

- **内部包源码直出，不打包**：`exports` 指向 `src/index.ts`，没有 `dist`。Node 侧 dev 和 prod 都用 `tsx` 直接跑 `.ts`
- **全 ESM**，相对 import 带 `.ts` 后缀
- **只用具名导出**。必须 default 的配置文件（vite/prisma config）写 inline `biome-ignore`
- **函数式，无 class**
- **Controller / Service 统一 arity-1 签名**：
  - `Service<T> = (app: ServiceApplication) => T` —— 纯函数工厂，闭包持有 app
  - `Controller = (app: WebApplication) => void` —— `WebApplication = Hono & ServiceApplication`
  - 每个 prefix 挂一个子 Hono 实例并把 services 合并上去，所以 `app.get(...)` 和 `app.health.check()` 在同一个对象上，controller 内注册的中间件天然限定在该 prefix
  - 横切关注点就是普通函数包装，见 `server/src/routes.ts` 里注释掉的 `guarded` 模板
  - 接线在 `server/src/context.ts` 按名字写死，不做字符串 key 遍历——依赖图可读、编译器能查
  - 持资源的用 `@idea/core` 的 `Resource` 元组返回 `[value, dispose]`，由 scope 倒序释放
- **测试测公开行为**，不测实现细节。controller 用 stub service 测，不碰数据库
- 代码、注释、commit 用英文；UI 文案用中文

## 凭据

真实凭据只进 gitignored 的 `.env`，**不进任何被提交的文件**。`src/config.ts` 与 `prisma.config.ts` 里的兜底值一律是本地无害值，不要改成真实地址。

`.gitignore` 用 `.env*` + `!.env.example`，新增 `.env.production` 这类文件默认被忽略。

生产库地址以**注释形态**记录在 `.env` 里，不要在本地取消注释——migration 和 seed 会打到当前生效的那个库上。部署时由环境注入。

对象存储（腾讯云 COS）凭据已记录但**尚未接入**，没有上传功能之前不写实现。注意 `COS_UPLOAD_PATH` 与 `ASSET_URL_SIGNING_SECRET` 必须与其他产品区分开，否则对象前缀会撞、签名 URL 会跨产品通用。

## 下一期

- 领域模型（User / Requirement / Worker / Session），`schema.prisma` 目前是零 model
- 登录、鉴权中间件、多租户 scope
- worker 注册协议、能力匹配派发、SSE 命令流、Claude Agent SDK 接入
- 需求澄清 agent 的 prompt 与工具
- 对象存储 service
- Docker 生产镜像、CI
