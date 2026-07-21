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
| `BROWSER_RESTART_INTERVAL_HOURS` | 定时重启浏览器间隔（小时），用于释放长期运行带来的 CPU/内存累积；设为 `0` 或不设则关闭 | `0`（关闭） |
| `CHROME_REMOTE_DEBUGGING_PORT` | 广大大 Chrome 远程调试端口（如 `9222`），开启后可在本机通过 DevTools 连接并操作页面、处理人机验证 | 不设则关闭 |
| `CHROME_REMOTE_DEBUGGING_PORT_INSIGHTRACKR` | Insightrackr Chrome 远程调试端口（如 `9223`） | 不设则关闭 |

**视频转码性能（可选）**：若需提高 `POST /api/transcode-video` 的转码速度，可配置以下环境变量（不设则使用默认或自动计算）：

| 变量 | 说明 | 默认 |
|------|------|------|
| `FFMPEG_THREADS` | 每个转码任务使用的 ffmpeg 线程数 | 按 CPU 逻辑核心数 75% ÷ 并发数 计算，至少 1 |
| `FFMPEG_PRESET` | 软件编码（libx264）速度预设，越快编码越快、体积略大 | `fast`（可选：`ultrafast`/`superfast`/`veryfast`/`faster`/`fast`/`medium`） |
| `FFMPEG_HWACCEL` | 硬件加速编码器：`nvenc`（NVIDIA GPU）/ `videotoolbox`（macOS）/ 不设则用软件编码 | 空 |
| `FFMPEG_BUF_SIZE_K` | 输入/输出缓冲区大小（KB），改善 IO 与内存效率 | `1024` |
| `FFMPEG_MAX_MUXING_QUEUE_SIZE` | 混流队列大小，避免“Too many packets buffered”等错误 | `1024` |

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

先在本地启动docker

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

### 4. 4 核服务器：为 Web 预留 1 核（可选）

若希望** 1 核专供 Web（Node + Puppeteer/Chrome），其余 3 核专供转码**，可设置环境变量 `FFMPEG_CPUS`，把 ffmpeg 绑到指定核（依赖容器内 `taskset`，镜像已包含）。

**4 核 16G 推荐配置**（转码并发已设为 3，留 1 核给 Web）：

```bash
docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e FFMPEG_CPUS=1,2,3 \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw
```

- 核 0：由 Node 与两个 Chrome 使用（Web、登录、数据抓取）。
- 核 1、2、3：仅跑 ffmpeg，最多 3 个转码同时进行。
- 不设 `FFMPEG_CPUS` 时，ffmpeg 可使用全部核（与 Web 共享，可能互相抢）。

---

## 三、生产环境检查清单

1. **路由顺序**：后端已保证 `/api` 路由在静态兜底（`*`）之前注册，避免 GET `/api/*` 被返回成前端页面。
2. **前端 API 地址**：前端请求统一使用相对路径 `/api`，与后端 `app.use('/api', apiRoutes)` 一致，同一域名下无需再配 API 地址。
3. **CORS**：当前允许所有来源；若生产需限制，可在 `server/app.js` 中调整 `cors()` 配置。
4. **Chrome**：直接部署时需在服务器安装 Chrome/Chromium；Docker 镜像内已包含 Chrome。

### 5. 降低空闲时 CPU 占用（可选）

服务长期运行两个 Puppeteer/Chrome 进程，无人使用时 CPU 也可能随时间缓慢上升。可采用以下方式**不重启整个服务**即降低占用：

- **Chrome 启动参数**（已为生产环境启用）：在 `server/src/config.js` 中已为生产环境增加 `--disable-gpu`、`--disable-background-networking`、`--disable-sync` 等参数，下次**重启服务**后生效，可减轻空闲时 CPU。
- **定时重启浏览器**：设置环境变量 `BROWSER_RESTART_INTERVAL_HOURS=6`（例如每 6 小时），进程会定时关闭并重新启动两个浏览器实例，**不重启 Node**，即可周期性释放 CPU/内存。重启浏览器期间若有请求会等待新浏览器就绪。
  - 直接部署示例：`BROWSER_RESTART_INTERVAL_HOURS=6 NODE_ENV=production npm start` 或 pm2 的 `env` 中配置。
  - Docker 示例：`docker run ... -e BROWSER_RESTART_INTERVAL_HOURS=6 ...`

### 5.1 Insightrackr 自动登录（可选）

在 `.env` 或 `docker run -e` 中配置（**勿将真实密码提交 Git**）：

```bash
-e INSIGHTRACKR_EMAIL=your-account@example.com \
-e INSIGHTRACKR_PASSWORD=your-password \
-e INSIGHTRACKR_AUTO_LOGIN=true \
-e INSIGHTRACKR_AUTO_LOGIN_INTERVAL_HOURS=6
```

服务启动、浏览器定时重启、健康检查页「重新打开窗口」后，若 Insightrackr 未登录将自动调用 Puppeteer 登录。

### 5.2 健康检查页重启 Docker 容器（可选）

需在容器中挂载 Docker 套接字，并启用开关：

```bash
docker run -d --name ads-scraw \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DOCKER_CONTAINER_RESTART_ENABLED=true \
  -e CONTAINER_NAME=ads-scraw \
  ...其他参数... ads-scraw
```

部署后访问 `/health`，具备运维权限的用户可在页面上点击「重启容器」。重启后若已配置 Insightrackr 凭据，将自动尝试登录。

### 6. 远程调试 Chrome（远程操作页面、处理人机验证）

部署后 Chrome 以**无头模式**运行，服务器上没有浏览器窗口可看。当广大大等平台出现人机验证、滑块或需要人工点击时，可通过 **Chrome 远程调试** 在本机连接服务器上的页面，用 DevTools 查看并操作（例如在 Console 里执行 JS 完成验证）。

- **开启后**：服务会在启动时为对应浏览器打开调试端口；**健康检查页**（前端「浏览器健康检查」）会显示调试端口与操作步骤，便于按说明连接。
- **安全**：调试端口仅用于排查，不建议长期对公网开放；用完可去掉环境变量并重启容器，或通过防火墙限制只允许本机/跳板机访问。

**步骤：**

1. **启动时开启调试端口**（需重启容器或服务）  
   - 广大大：`CHROME_REMOTE_DEBUGGING_PORT=9222`  
   - Insightrackr：`CHROME_REMOTE_DEBUGGING_PORT_INSIGHTRACKR=9223`  
   - Docker 示例（只调试广大大）：
     ```bash
     docker run -d --name ads-scraw -p 3000:3000 -p 9222:9222 \
       -e NODE_ENV=production \
       -e CHROME_REMOTE_DEBUGGING_PORT=9222 \
       ...其他参数... ads-scraw
     ```
   - 若两个都开：再增加 `-p 9223:9223` 和 `-e CHROME_REMOTE_DEBUGGING_PORT_INSIGHTRACKR=9223`。

2. **本机做 SSH 隧道**（若 9222/9223 未直接暴露到公网，推荐）  
   ```bash
   ssh -i ~/.ssh/你的密钥 -L 9222:localhost:9222 用户@服务器IP
   ```
   保持该 SSH 连接不断开。Insightrackr 用 9223 时同理：`-L 9223:localhost:9223`。

3. **本机用 Chrome 连接并操作**  
   - 浏览器打开：`http://localhost:9222`（广大大）或 `http://localhost:9223`（Insightrackr）  
   - 会列出当前所有标签页（targets），点击某个页面的链接即可打开 **DevTools**：可看 DOM、Console、Network、Elements。  
   - **处理人机验证**：在 DevTools 的 **Console** 里执行 JavaScript 模拟点击或操作，例如：  
     `document.querySelector('验证码/按钮的选择器')?.click()`  
     可根据页面元素自行替换选择器，完成验证后页面状态会同步到服务器上的浏览器。

**注意**：无头模式下通过远程调试连接后，你看到的是服务器上该页面的实时状态，在 Console 中执行的 JS 也在服务器端生效，因此可用来完成人机验证等操作。

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
scp -i ~/.ssh/id_ed25519_nginx ads-scraw-docker.tar ecs-user@115.29.236.160:/home/ecs-user/

# 3. 在服务器上加载并启动（4 核 16G 推荐：留 1 核给 Web，转码并发 3）
ssh -i ~/.ssh/id_ed25519_nginx ecs-user@115.29.236.160 "cd /home/ecs-user && sudo docker load -i ads-scraw-docker.tar && sudo docker stop ads-scraw 2>/dev/null || true && sudo docker rm ads-scraw 2>/dev/null || true && sudo docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production -e FFMPEG_CPUS=1,2,3 --restart unless-stopped --shm-size=1g ads-scraw:latest"
```

完成后访问：`http://115.29.236.160:3000`。

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

# 运行新容器（4 核 16G 推荐：留 1 核给 Web，转码并发 3）
sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e FFMPEG_CPUS=1,2,3 \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw:latest
```

访问 `http://<服务器IP>:3000`。

---

## 六、推送镜像到远程（容器仓库或服务器）

构建并打标签后，可用以下任一方式把镜像推到远程。

### 6.1 本地构建镜像（可复用的命令）

在项目根目录执行（二选一）：

```bash
# 当前机器架构（如 Mac arm64）
docker build -t ads-scraw:latest .

# 若目标服务器为 x86/amd64（如多数云主机），推荐使用项目脚本（会构建 linux/amd64 并导出 tar）
./scripts/build-docker-and-export.sh
```

若使用脚本，会得到 `ads-scraw-docker.tar`，后续按「6.3 通过 docker save/load 上传到服务器」操作即可。

### 6.2 推送到容器镜像仓库

**Docker Hub**

```bash
# 登录（首次）
docker login

# 打标签（将 your-dockerhub-username 换成你的用户名）
docker tag ads-scraw:latest your-dockerhub-username/ads-scraw:latest

# 推送
docker push your-dockerhub-username/ads-scraw:latest
```

在服务器上拉取并运行：

```bash
docker pull your-dockerhub-username/ads-scraw:latest
docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g your-dockerhub-username/ads-scraw:latest
```

**私有仓库（通用格式）**

将 `REGISTRY` 换成你的仓库地址（如 `registry.example.com` 或 `xxx.azurecr.io`、`xxx.dkr.ecr.region.amazonaws.com` 等）：

```bash
# 登录私有仓库（按该仓库要求执行，例如）
# docker login registry.example.com

docker tag ads-scraw:latest REGISTRY/ads-scraw:latest
docker push REGISTRY/ads-scraw:latest
```

在服务器上：

```bash
# docker login REGISTRY   # 若需要
docker pull REGISTRY/ads-scraw:latest
docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g REGISTRY/ads-scraw:latest
```

### 6.3 通过 docker save/load 上传到服务器（无镜像仓库时）

适用于不使用镜像仓库、直接通过 SCP 把镜像传到目标机器的情况（详见上文「五、本地构建 Docker 镜像再上传到服务器」）。

**本地：导出并上传**

```bash
# 导出镜像为 tar（默认生成 ads-scraw-docker.tar）
docker save ads-scraw:latest -o ads-scraw-docker.tar

# 上传到服务器（替换为你的密钥、用户、IP 和路径）
scp -i ~/.ssh/你的密钥 ads-scraw-docker.tar 用户@服务器IP:/home/xxx/
```

**服务器上：加载并运行**

```bash
cd /home/xxx   # 或你上传到的目录

docker load -i ads-scraw-docker.tar
docker stop ads-scraw 2>/dev/null || true
docker rm ads-scraw 2>/dev/null || true
docker run -d --name ads-scraw -p 3000:3000 -e NODE_ENV=production --restart unless-stopped --shm-size=1g ads-scraw:latest
```

---

## 八、Docker 备份与回退

### 8.1 部署前自动备份

`./scripts/deploy-docker-remote.sh` 在发布前会默认执行 `./scripts/backup-docker-remote.sh`（**轻量模式**：仅 `docker save ads-scraw:latest`，约 2GB、数分钟）。

全量备份（含 Chrome 会话等容器层，约 10GB、15～30 分钟）：

```bash
FULL_BACKUP=1 ./scripts/backup-docker-remote.sh
```

在远程服务器上：

1. `docker commit` 当前运行容器为 `ads-scraw:backup-YYYYMMDDHHMMSS`
2. `docker save` 导出为 `/home/ecs-user/ads-scraw-backup-*.tar`
3. 保存 `ads-scraw-inspect-*.json`（含当时环境变量与端口映射）

仅备份、不部署：

```bash
./scripts/backup-docker-remote.sh
```

跳过备份直接部署：

```bash
SKIP_BACKUP=1 ./scripts/deploy-docker-remote.sh
```

### 8.2 回退到备份版本

SSH 登录服务器后（将 `BACKUP_TAG` 换成实际备份 tag，如 `backup-20260623143000`）：

```bash
cd /home/ecs-user
sudo docker stop ads-scraw 2>/dev/null || true
sudo docker rm ads-scraw 2>/dev/null || true

# 若 tar 已存在可直接 load；否则 tag 已在本地镜像列表中
sudo docker load -i ads-scraw-backup-BACKUP_TAG.tar

sudo docker run -d \
  --name ads-scraw \
  -p 3000:3000 \
  -p 9222:9222 \
  -e NODE_ENV=production \
  -e CHROME_REMOTE_DEBUGGING_PORT=9222 \
  -e FFMPEG_CPUS=1,2,3 \
  --restart unless-stopped \
  --shm-size=1g \
  ads-scraw:BACKUP_TAG
```

若备份时使用了 `--env-file`，可从 `ads-scraw-inspect-BACKUP_TAG.json` 的 `Config.Env` 还原当时参数。

### 8.3 生产环境变量文件

部署脚本从本地 `.env` 提取服务端变量，生成 `ads-scraw-production.env` 并上传到服务器（**勿提交 Git**）：

```bash
./scripts/prepare-production-env.sh
```

包含 IAM、MySQL、Insightrackr 等 `docker run --env-file` 所需项。详见 `docs/IAM-ACCESS.md`。

---

## 九、IAM 与 MySQL

- **IAM 接入、宽松模式、权限模型**：见 [docs/IAM-ACCESS.md](docs/IAM-ACCESS.md)
- **迭代发布记录**：见 [docs/iterations/2026-06-23-mysql-iam-relaxed-deploy.md](docs/iterations/2026-06-23-mysql-iam-relaxed-deploy.md)

---

## 七、简要架构（生产）

- 单进程：Express 同时提供 **API**（`/api/*`）和 **前端静态资源**（`dist/`）。
- 未命中静态文件且非 API 的 GET 请求会回退到 `dist/index.html`，由前端路由处理。
- 开发时可用 `npm run dev` 分别起 Vite（前端）和 Node（后端）；生产只需 `npm start`（或 Docker CMD），不再单独起前端服务。
