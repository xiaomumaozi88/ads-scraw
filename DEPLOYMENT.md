# 部署说明

本文说明如何将本项目部署到服务器或容器环境。

## 前置要求

- **Node.js**：>= 16（推荐 18+）
- **Chrome/Chromium**：Puppeteer 需要用于 Insightrackr、广大大登录与请求
- 部署环境需能访问目标平台（Insightrackr、广大大）网站

---

## 一、直接部署（服务器上运行）

### 1. 安装依赖与构建

```bash
# 克隆或上传代码后
cd ads-scraw
npm install
npm run build
```

构建产物在项目根目录的 `dist/` 下，由后端在同一进程中提供静态资源。

### 2. 启动服务

```bash
# 生产模式（会读取 NODE_ENV=production 并挂载 dist）
export NODE_ENV=production
npm start
```

或使用已有脚本（先构建再启动）：

```bash
npm run start:prod
```

服务默认监听 **3000** 端口，可通过环境变量 `PORT` 修改。

### 3. 环境变量（可选）

在项目根目录创建 `.env`，或通过系统环境变量传入：

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 服务监听端口 | `3000` |
| `NODE_ENV` | 生产环境请设为 `production` | - |

平台登录、API 等敏感信息由用户在浏览器端操作，后端主要使用 Puppeteer 与各平台站点交互，一般无需在服务器上配置平台账号。

### 4. 进程守护（推荐）

使用 **pm2** 保持进程常驻并开机自启：

```bash
npm install -g pm2
NODE_ENV=production pm2 start server/app.js --name ads-scraw
pm2 save
pm2 startup
```

若希望用 pm2 直接跑 Node（而不是 `npm start`），需在项目根目录执行，且保证已执行过 `npm run build`，例如：

```bash
cd /path/to/ads-scraw
npm run build
NODE_ENV=production pm2 start server/app.js --name ads-scraw
```

---

## 二、Docker 部署

### 1. 构建镜像

在项目根目录执行：

```bash
docker build -t ads-scraw .
```

镜像内已包含：Node 18、Google Chrome、生产依赖、前端构建产物（`dist`）及后端代码。

### 2. 运行容器

```bash
docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw
```

访问：`http://<主机IP>:3000`。

### 3. 注意事项（Docker）

- Puppeteer 在容器内会启动 Chrome，默认无需挂载显示或额外配置即可使用无头模式。
- 若遇到 Chrome 启动失败，可尝试在 `docker run` 中增加：`--shm-size=1g`。
- 需访问外网（Insightrackr、广大大）时，保证容器网络可出网。

---

## 三、生产环境检查清单

1. **路由顺序**：后端已保证 `/api` 路由在静态兜底（`*`）之前注册，避免 GET `/api/*` 被返回成前端页面。
2. **前端 API 地址**：前端请求统一使用相对路径 `/api`，与后端 `app.use('/api', apiRoutes)` 一致，同一域名下无需再配 API 地址。
3. **CORS**：当前允许所有来源；若生产需限制，可在 `server/app.js` 中调整 `cors()` 配置。
4. **Chrome**：直接部署时需在服务器安装 Chrome/Chromium；Docker 镜像内已包含 Chrome。

---

## 四、重新上传并 Docker 重新部署（完整流程）

适用于：之前用 SCP 上传、在服务器上用 `sudo docker stop ads-scraw` 的方式，现在要**重新上传整个项目并重新部署**。

### 1. 本地上传项目到服务器

在**本地项目根目录**执行（将 `你的密钥`、`用户@服务器IP`、`/home/xxx/ads-scraw` 换成自己的）：

```bash
# 方式 A：用 scp 上传整个项目（排除 node_modules、.git 等）
scp -i ~/.ssh/你的密钥 -r \
  --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='*.log' \
  . 用户@服务器IP:/home/xxx/ads-scraw/
```

> 注意：`scp` 不支持 `--exclude`，若需排除目录，可改用下面的 rsync，或先打包再传。

**推荐：用 rsync 上传（支持排除、增量）**

```bash
# 在项目根目录
rsync -avz --delete -e "ssh -i ~/.ssh/你的密钥" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  . 用户@服务器IP:/home/xxx/ads-scraw/
```

### 2. 在服务器上停止旧容器、删除旧镜像（可选）、重新构建并运行

SSH 登录服务器后：

```bash
# 进入项目目录（路径与上面一致）
cd /home/xxx/ads-scraw

# 停止并删除旧容器（若存在）
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true

# 重新构建镜像
sudo docker build -t ads-scraw .

# 运行新容器
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw
```

### 3. 一键脚本（可选）

在服务器上保存为 `redeploy.sh`，放在项目目录，每次上传后执行 `./redeploy.sh` 即可：

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true
sudo docker build -t ads-scraw .
sudo docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g ads-scraw
echo ">>> 部署完成，访问 http://<服务器IP>:3000"
```

---

## 五、本地构建 Docker 镜像再上传到服务器（推荐：服务器无法访问 jsDelivr 时）

当服务器构建时从 cdn.jsDelivr 下载 ffmpeg-core 超时（ETIMEDOUT）时，可在**本地**构建镜像并导出，再上传到服务器加载运行。  
本地为 Mac（arm64）时，脚本会使用 `--platform linux/amd64` 构建，以便在 x86 服务器上运行。

### 快速参考（三步复制执行）

在**项目根目录**依次执行（密钥/用户/IP 按自己环境替换）：

```bash
# 1. 本地构建并导出（约 3～5 分钟，生成 ads-scraw-docker.tar，约 700MB）
./scripts/build-docker-and-export.sh

# 2. 上传到服务器（约 1～2 分钟）
scp -i ~/.ssh/id_ed25519_nginx ads-scraw-docker.tar ecs-user@120.27.200.123:/home/ecs-user/

# 3. 在服务器上加载并启动（需 sudo 若当前用户不在 docker 组）
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@120.27.200.123 "cd /home/ecs-user && sudo docker load -i ads-scraw-docker.tar && sudo docker stop ads-scraw 2>/dev/null || true && sudo docker rm ads-scraw 2>/dev/null || true && sudo docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g ads-scraw:latest"
```

完成后访问：`http://120.27.200.123:3000`。

---

### 1. 本地：构建并导出镜像

在项目根目录执行：

```bash
chmod +x scripts/build-docker-and-export.sh
./scripts/build-docker-and-export.sh
```

会在当前目录生成 `ads-scraw-docker.tar`（约 700MB～1GB）。也可指定输出路径：

```bash
./scripts/build-docker-and-export.sh /tmp/ads-scraw.tar
```

### 2. 上传到服务器

将生成的 tar 文件传到服务器（替换为你的密钥、用户、IP 和路径）：

```bash
scp -i ~/.ssh/你的密钥 ads-scraw-docker.tar 用户@服务器IP:/home/xxx/
```

### 3. 服务器上：加载镜像并运行

SSH 登录服务器后（若普通用户无 Docker 权限，命令前加 `sudo`）：

```bash
cd /home/xxx   # 或你上传到的目录

# 加载镜像
sudo docker load -i ads-scraw-docker.tar

# 停止并删除旧容器（若存在）
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true

# 运行新容器
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw:latest
```

访问 `http://<服务器IP>:3000`。

---

## 六、简要架构（生产）

- 单进程：Express 同时提供 **API**（`/api/*`）和 **前端静态资源**（`dist/`）。
- 未命中静态文件且非 API 的 GET 请求会回退到 `dist/index.html`，由前端路由处理。
- 开发时可用 `npm run dev` 分别起 Vite（前端）和 Node（后端）；生产只需 `npm start`（或 Docker CMD），不再单独起前端服务。
