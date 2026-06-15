# 广告数据查询平台

一个基于 React + Node.js 的多平台广告数据查询系统，支持 Insightrackr 和广大大平台。

## 功能模块（已实现）

已实现功能按模块的详细说明见 **[docs/功能说明.md](docs/功能说明.md)**，包括：平台入口与登录、Insightrackr 查询、广大大查询、创意展示与详情、批量下载、健康与运维等。

## 技术栈

### 前端

- **React 18** - UI 框架
- **Vite** - 构建工具和开发服务器
- **CSS3** - 样式

### 后端

- **Node.js** - 运行时
- **Express** - Web 框架
- **Puppeteer** - 浏览器自动化
- **内置 logger**（`server/src/utils/logger.js`）- 日志记录

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

- **Vite 开发服务器（前端页面请打开此地址）**：[http://localhost:5173](http://localhost:5173)
- Express 服务器（后端 API）：[http://localhost:3000](http://localhost:3000)

开发模式下 **`http://localhost:3000` 不托管 React**，直接访问根路径会由服务端 **302 重定向到** `http://localhost:5173`（同路径，例如 `/sensortower` → `http://localhost:5173/sensortower`）。若你修改了 Vite 端口，请设置环境变量 `DEV_CLIENT_ORIGIN` 与之一致（如 `http://127.0.0.1:5174`）。

**若浏览器里是 Vite 默认「Get started」、标签标题也不是「广告数据查询平台」**，按下面顺序排查（本项目源码里 **没有** create-vite 默认页；同一端口若 `curl` 与浏览器表现不一致，多半是 **代理或缓存**）：

1. **查看网页源代码**（右键 → 显示网页源代码）：应能看到注释 `ads-scraw: client/index.html`，且 `<title>` 为「广告数据查询平台」。若看不到，说明当前 **HTTP 响应不是本仓库的 `client/index.html`**（例如走了代理或连到了别的进程）。
2. **开发者工具 → Console**：启动开发后应出现 **`[ads-scraw] 开发入口已加载`**。若没有，说明 **`/src/main.jsx` 未被执行**（可在 Network 里看该请求是否 200、是否来自 `localhost:5173`）。
3. **改用 IP 访问**：先试 **`http://127.0.0.1:5173/`**（避免部分环境下 `localhost` 解析/代理异常）；再试终端里打印的 **局域网地址**（如 `http://192.168.x.x:5173/`）。
4. **系统代理 / Clash / VPN**：若终端里出现类似 **`198.18.x.x`** 的网卡，请将 **`localhost`、`127.0.0.1`** 加入 **绕过代理 / DIRECT**，避免本机开发流量被错误转发。
5. **5173 端口占用**：本项目已启用 **`strictPort`**；若启动报错，请先释放端口后再 `npm run dev`。也可用 **无痕窗口** 或 **强制刷新**（macOS：`Cmd+Shift+R`）排除旧缓存。

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

## API 端点

### Insightrackr

- `POST /api/insightrackr/login` - 登录
- `GET /api/insightrackr/status` - 获取登录状态
- `POST /api/insightrackr/search` - 搜索数据
- `POST /api/insightrackr/clearLogin` - 清除登录状态

#### 外部素材查询接口（带筛选）

- `GET /api/external/insightrackr/top50`
- `POST /api/external/insightrackr/top50`

请求体（或等价的 query 参数）：

- **keyWord**：必填，关键词字符串。
- **sortBy**：可选，排序字段，取值：`heat`（默认，热度）、`exposure`（曝光预估）、`share`、`like`、`comment`，也支持对应的中文别名。
- **topN**：可选，返回素材条数，默认 50，最大 500。
- **timeRange**：可选，时间范围快捷值：`7d` / `30d` / `90d` / `1y`（近一年）。  
- **startDate / endDate**：可选，显式日期范围（`YYYY-MM-DD`）。如果提供，将优先于 `timeRange` 生效。
- **countryLevel2**：可选，Insightrackr 国家 / 地区 code 数组，等同前端表单中的 `countryLevel2`，例如：`["US","JP"]`。
- **languages**：可选，标题语言 code 数组，等同前端表单中的语言选择，例如：`["en","zh-cn"]`。
- **materialType**：可选，素材类型，字符串 `"1"`（图片）、`"2"`（视频），等同前端 `creativeType`。
- **aspectRatio**：可选，画面比例，统一枚举：
  - `landscape` / `横版`：在 Insightrackr 中映射为 `creativeList` 里的 `gs=1`
  - `portrait` / `竖版`：映射为 `gs=2`
  - `square` / `方形`：映射为 `gs=3`

说明：

- 时间范围最终会写入 `baseOption.startTime` / `endTime`，格式为 `YYYY-MM-DD`。
- `countryLevel2`、`languages`、`materialType`、`aspectRatio` 均是对现有 Insightrackr 搜索表单字段的薄封装，内部不做额外魔改，只负责规范化格式。

### 广大大（待实现）

- `POST /api/guangdada/login` - 登录
- `GET /api/guangdada/status` - 获取登录状态
- `POST /api/guangdada/search` - 搜索数据
- `POST /api/guangdada/clearLogin` - 清除登录状态

#### 外部素材查询接口（带筛选）

- `GET /api/external/guangdada/top50`
- `POST /api/external/guangdada/top50`

请求体（或等价的 query 参数）：

- **keyWord**：必填，关键词字符串。
- **sortBy**：可选，排序字段，取值：`heat`（默认，热度）、`exposure`（曝光估值）、`share`、`like`、`comment`，也支持对应的中文别名。
- **topN**：可选，返回素材条数，默认 50，最大 500。
- **timeRange**：可选，时间范围快捷值：`7d` / `30d` / `90d` / `1y`。
- **startDate / endDate**：可选，显式日期范围（`YYYY-MM-DD`）。如果提供，将优先于 `timeRange` 生效。
- **guangdadaCountry**：可选，广大大国家 / 地区 code 数组，取值与前端 `GUANGDADA_COUNTRY_CATEGORIES` 一致，例如：`["USA","JPN"]`。
- **guangdadaCopyLangs**：可选，文案语言 code 数组，取值与 `GUANGDADA_COPY_LANG_OPTIONS` 一致，例如：`["zh-CN","en"]`。
- **guangdadaMediaType / materialType**：可选，素材类型：
  - `'image'` / `'图片'` → 图片
  - `'video'` / `'视频'` → 视频
  - `'carousel'` / `'轮播'`
  - `'html'`
  - `'playable'` / `'试玩'` / `'试玩广告'`
  内部会映射为广大大 API 的 `ads_type` 数组（例如图片=1、视频=2 等）。
- **aspectRatio**：可选，画面比例，统一枚举：
  - `portrait` / `竖版`：映射为 `ads_format = ["1:2","9:16","3:4","4:5"]`
  - `landscape` / `横版`：映射为 `ads_format = ["2:1","16:9","4:3","5:4","banner"]`
  - `square` / `方形`：映射为 `ads_format = ["1:1"]`

说明：

- 时间范围最终会写入广大大接口的 `seen_begin` / `seen_end`（Unix 秒级时间戳），按北京时间 00:00:00～23:59:59 计算。
- 国家、语言、素材类型、画面比例等字段与站内广大大搜索使用的是同一套 code 与语义，便于服务端和前端共用枚举。

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

## 远程调试与人机验证

服务部署在无头服务器上时，若出现人机验证（如广大大需在页面内完成验证），可通过 Chrome 远程调试 + SSH 隧道在本机打开远程页面的 DevTools，在 Console 里完成验证等操作。**不依赖** `http://localhost:9222` 的网页是否“显示正常”，只要隧道通，Chrome 会通过 `chrome://inspect` 直接列出远程目标并打开 DevTools。

原理：广大大使用的浏览器进程会开启内部远程调试端口；容器内由 **socat** 将 `0.0.0.0:9222` 转发到 Chrome 的调试端口，因此映射宿主 `-p 9222:9222` 后，经 SSH 转发到本机即可用 DevTools 连接。

更完整的部署说明见 **[DEPLOYMENT.md](DEPLOYMENT.md)** 第六节。

### 一、Docker 侧：开启广大大调试端口（在服务器上执行）

首次启用或曾用旧参数起容器时，需要**重建容器**（会短暂中断服务）。下面示例与生产环境一致：**广大大调试** + 常见转码 CPU 预留；若你当前容器还有其它 `-e`，请先查看再合并进 `docker run`。

**1）查看现有容器环境变量（可选，便于对齐旧配置）：**

```bash
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123 \
  "sudo docker inspect ads-scraw --format '{{json .Config.Env}}' | python3 -m json.tool"
```

（将密钥路径、`用户@主机` 换成你的；下文同。）

**2）停止并删除旧容器，用调试端口重新启动：**

```bash
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123 'set -e
sudo docker stop ads-scraw
sudo docker rm ads-scraw
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -p 9222:9222 \
  -e NODE_ENV=production \
  -e FFMPEG_CPUS=1,2,3 \
  -e FFMPEG_PRESET=veryfast \
  -e CHROME_REMOTE_DEBUGGING_PORT=9222 \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw:latest
sudo docker ps --filter name=ads-scraw --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"'
```

**3）确认容器内已监听调试端口（应用启动约数秒后再执行）：**

```bash
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123 \
  "sudo docker exec ads-scraw sh -c 'ss -tlnp 2>/dev/null | grep -E \"9222|9223\" || netstat -tlnp 2>/dev/null | grep -E \"9222|9223\" || true'"
```

期望看到类似：`socat` 监听 `0.0.0.0:9222`，Chrome 监听 `127.0.0.1:9223`（内部端口由应用逻辑分配，无需单独映射）。

**4）确认 Web 端口正常（可选）：**

```bash
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123 \
  "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/"
```

期望输出 `200`。

### 二、本机：SSH 隧道与 Chrome 连接

**1）建立隧道（保持该终端不关，不要加 `sudo`）：**

将本机 `9222` 转发到服务器上的 `127.0.0.1:9222`（密钥与 `用户@主机` 换成你的；与下文打包示例一致时可直接复制）：

```bash
ssh -i ~/.ssh/id_ed25519_nginx \
  -o StrictHostKeyChecking=accept-new \
  -L 9222:127.0.0.1:9222 \
  ecs-user@120.27.200.123
```

若该私钥路径不存在、改用默认 `~/.ssh/id_*`，可去掉 `-i ...` 一行。

**2）后台隧道（可选）：**

```bash
ssh -f -N -o ExitOnForwardFailure=yes \
  -o StrictHostKeyChecking=accept-new \
  -i ~/.ssh/id_ed25519_nginx \
  -L 9222:127.0.0.1:9222 \
  ecs-user@120.27.200.123
```

若提示 `Address already in use`，说明本机 `9222` 已被占用（例如已有隧道）。可结束占用进程，或改用其它本地端口转发，例如 `-L 19223:127.0.0.1:9222`，并在 `chrome://inspect` 的 Configure 里填 `localhost:19223`。

**3）Chrome 连接：** 地址栏打开 **chrome://inspect** →「Configure」→ 添加 **localhost:9222**（若改了本地端口则用对应端口）→ 在「Remote Target」中选广大大相关页面 → 点 **inspect**，在 DevTools 的 **Console** 中完成人机验证等操作。

也可直接访问 `http://localhost:9222` 查看可调试目标列表。

### 三、使用说明与常见问题

**Inspect 里「页面」一直不加载？** 线上是 headless 浏览器，没有真实界面，DevTools 里**页面预览**可能空白或一直转圈，属正常现象。只要 **Console**、**Elements**、**Network** 可用即可；人机验证可在 **Console** 用 JS 操作（如 `document.querySelector('...')?.click()`），结合 **Elements** 查看 DOM。

**为什么只能在本机操作？** 服务器无图形界面，无法在服务器上打开桌面 Chrome。必须在本机用 Chrome 经 SSH 连到远程调试端口，由本机 DevTools 附着到服务器上的页面。

**安全提示：** 调试端口具备较高权限，不建议长期对公网裸暴露；优先使用 SSH 转发，调试结束后可去掉 `CHROME_REMOTE_DEBUGGING_PORT` 并重建容器以关闭端口映射。

## 许可证

MIT

#打包发布
##在本地项目文件夹

```
tar --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='*.log' -czvf /tmp/ads-scraw.tar.gz .

scp -i ~/.ssh/id_ed25519_nginx /tmp/ads-scraw.tar.gz ecs-user@120.27.200.123:~/ads-scraw.tar.gz
```

##在服务器

```
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123
cd ~
rm -rf ads-scraw
mkdir -p ads-scraw
tar -xzvf ads-scraw.tar.gz -C ads-scraw
rm ads-scraw.tar.gz
cd ads-scraw
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true
sudo docker build -t ads-scraw .
sudo docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g ads-scraw
```

