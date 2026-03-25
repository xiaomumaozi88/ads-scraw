# 阶段一：构建前端
FROM node:18-buster AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
# 跳过 Puppeteer 与 postinstall（国内构建时从 jsDelivr 下载 ffmpeg-core 易 ETIMEDOUT）
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --ignore-scripts
COPY . .
# 尝试下载 ffmpeg-core 到 client/public/，失败不中断构建（前端运行时会回退 CDN）
RUN node scripts/download-ffmpeg-core.js || true
RUN npm run build

# 阶段二：运行环境（含 Chrome，供 Puppeteer 使用）
FROM node:18-buster

ENV BUILD=1

# Buster 已归档，使用阿里云 debian-archive 源
RUN echo "deb http://mirrors.aliyun.com/debian-archive/debian/ buster main" > /etc/apt/sources.list \
  && echo "deb http://mirrors.aliyun.com/debian-archive/debian/ buster-updates main" >> /etc/apt/sources.list \
  && echo "deb http://mirrors.aliyun.com/debian-archive/debian-security buster/updates main" >> /etc/apt/sources.list \
  && apt-get clean && apt-get update \
  && apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing

# 直接下载 Chrome .deb 安装，避免 apt 源中 google-chrome-stable 无法定位
# .deb 安装后二进制为 /usr/bin/google-chrome-stable，创建 google-chrome 供 Puppeteer 使用
RUN apt-get update && apt-get install -y ffmpeg util-linux socat --fix-missing \
  && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb \
  && dpkg -i /tmp/chrome.deb || apt-get install -f -y \
  && ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome \
  && rm -f /tmp/chrome.deb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
# 运行时阶段不需要 postinstall（ffmpeg-core 已在 builder 阶段下载并打入 dist）
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000 9222
CMD ["node", "server/app.js"]
