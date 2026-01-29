# 广告数据查询平台

一个基于 React + Node.js 的多平台广告数据查询系统，支持 Insightrackr 和广大大平台。

## 技术栈

### 前端
- **React 18** - UI 框架
- **Vite** - 构建工具和开发服务器
- **CSS3** - 样式

### 后端
- **Node.js** - 运行时
- **Express** - Web 框架
- **Puppeteer** - 浏览器自动化
- **Log4js** - 日志记录

## 项目结构

```
ads-scraw/
├── client/                 # React 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── utils/          # 工具函数
│   │   ├── styles/         # 样式文件
│   │   ├── App.jsx         # 主应用组件
│   │   └── main.jsx        # 入口文件
│   └── index.html          # HTML 模板
├── server/                 # 后端代码
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 服务层
│   │   ├── routes/         # 路由
│   │   ├── utils/         # 工具函数
│   │   ├── config/         # 配置文件
│   │   └── constants/      # 常量定义
│   └── app.js             # Express 服务器入口
├── package.json
├── vite.config.js          # Vite 配置
└── README.md
```

## 安装依赖

```bash
npm install
```

## 开发

### 同时启动前端和后端（推荐）

```bash
npm run dev
```

这将同时启动：
- Vite 开发服务器（前端）：http://localhost:5173
- Express 服务器（后端）：http://localhost:3000

### 分别启动

**前端开发服务器：**
```bash
npm run dev:client
```

**后端服务器：**
```bash
npm run dev:server
```

## 构建

构建 React 应用用于生产环境：

```bash
npm run build
```

构建后的文件将输出到 `dist/` 目录。

## 生产环境运行

```bash
npm run start:prod
```

这将先构建 React 应用，然后启动生产服务器。

或者，如果已经构建过：

```bash
npm start
```

## 功能特性

- ✅ 多平台支持（Insightrackr / 广大大）
- ✅ 用户登录和状态管理
- ✅ 高级搜索功能
- ✅ 数据卡片展示
- ✅ 操作日志记录
- ✅ 响应式设计

## API 端点

### Insightrackr

- `POST /api/insightrackr/login` - 登录
- `GET /api/insightrackr/status` - 获取登录状态
- `POST /api/insightrackr/search` - 搜索数据
- `POST /api/insightrackr/clearLogin` - 清除登录状态

### 广大大（待实现）

- `POST /api/guangdada/login` - 登录
- `GET /api/guangdada/status` - 获取登录状态
- `POST /api/guangdada/search` - 搜索数据
- `POST /api/guangdada/clearLogin` - 清除登录状态

## 环境变量

创建 `.env` 文件：

```env
PORT=3000
NODE_ENV=development
INSIGHTRACKR_EMAIL=your-email@example.com
INSIGHTRACKR_PASSWORD=your-password
```

## 注意事项

1. 确保已安装 Chrome/Chromium，Puppeteer 需要它来运行浏览器自动化
2. 开发环境下，前端通过 Vite 代理访问后端 API
3. 生产环境下，Express 服务器会直接提供构建后的 React 应用

## 许可证

MIT
