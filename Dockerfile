# 阶段一：构建前端
FROM node:18-buster AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# 跳过 Puppeteer 下载 Chrome（国内易 ECONNRESET），运行时用 apt 安装的 Chrome
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci
COPY . .
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
  && apt-get update && apt-get install -y google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/app.js"]
