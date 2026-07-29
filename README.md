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

默认使用内置演示数据，可完整体验主要页面和交互。接入 Control Service 时配置：

```bash
VITE_USE_MOCK=false
VITE_CONTROL_API_BASE=/api/control
VITE_LOGIN_URL=https://login.verdantflarehub.com/sign-in
VITE_WWW_URL=https://www.verdantflarehub.com
```

`VITE_CONTROL_API_BASE` 是 Hub 唯一的 Center 业务入口。Market 与 Experience 首期仍由 Control Service 的内部模块承载，前端不依赖未来是否拆分独立服务。

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
