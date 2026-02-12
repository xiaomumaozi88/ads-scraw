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
ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1

# Buster 已归档，使用阿里云 debian-archive 源
RUN echo "deb http://mirrors.aliyun.com/debian-archive/debian/ buster main" > /etc/apt/sources.list \
  && echo "deb http://mirrors.aliyun.com/debian-archive/debian/ buster-updates main" >> /etc/apt/sources.list \
  && echo "deb http://mirrors.aliyun.com/debian-archive/debian-security buster/updates main" >> /etc/apt/sources.list \
  && apt-get clean && apt-get update \
  && apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing

RUN wget -qO - https://dl.google.com/linux/linux_signing_key.pub | tee /etc/apt/trusted.gpg.d/google.asc \
  && sh -c 'echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list' \
  && apt-get update && apt-get install -y google-chrome-stable ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
# 运行时阶段不需要 postinstall（ffmpeg-core 已在 builder 阶段下载并打入 dist）
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/app.js"]
