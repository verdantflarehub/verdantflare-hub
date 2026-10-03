# VerdantFlare Hub

VerdantFlare Center 的统一业务前端，承载应用 Market、在线体验、API Center、组织设置与内部运营页面。

## 技术栈

- Vue 3
- Vite 6
- 原生 CSS
- Nginx 静态托管

工程沿用 `verdantflare-www` 的轻量前端技术栈。首期不引入 UI 组件库和独立路由依赖，路由、权限感知 Shell 与业务组件均由项目自身维护。

## 本地开发

```bash
npm install
npm run dev
```

本地开发默认连接 Control Service，不内置演示业务数据。配置：

```bash
VITE_CONTROL_API_BASE=/api/control
VITE_LOGIN_URL=https://login.verdantflarehub.com/sign-in
VITE_WWW_URL=https://www.verdantflarehub.com
```

`VITE_CONTROL_API_BASE` 是 Hub 唯一的 Center 业务入口。Market 与 Experience 首期仍由 Control Service 的内部模块承载，前端不依赖未来是否拆分独立服务。

工作台、应用市场、组织成员和内部运营页面读取 Control 接口。模型目录与任务在网关接入前为空，用量与账单显示不可用；历史 Control Key 不能调用 `verdantflare-api`，新建入口暂停。在线 Playground 与真实体验工作区暂不开放，页面不会模拟成功结果。

内部 `api_ops_admin` 在 `/ops/models` 编辑模型公开资料和报价，`app_ops_admin` 在应用发布页编辑 WWW 当前版本、简介和资源资料。新模型与应用默认不公开；显式公开后由 Control 的匿名只读接口供 WWW 展示。这些是目录资料，不是网关结算价或 Station 部署状态。

本地联调时先在 `verdantflare-service-control` 启动 Go 服务，然后执行：

```bash
cp .env.example .env
npm run dev
```

Vite 会将 `/api/control/*` 代理到 `http://localhost:8080`，浏览器继续使用同源 Cookie 和接口路径。

## 构建

```bash
npm run build
```

工作区级自动化检查：`scripts/tests/hub_control_integration.sh`（需要 Docker、Go、npm；使用独立临时 PostgreSQL）。
