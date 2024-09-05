FROM node:18-buster

ENV BUILD=1
ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1

# 更新源为 HTTPS
RUN sed -i 's/http/https/g' /etc/apt/sources.list

# 清理和更新
RUN apt-get clean
RUN apt-get update

# 安装依赖
RUN apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing

# 添加 Google Chrome 的 GPG 密钥
RUN wget -qO - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -

# 添加 Google Chrome 的不稳定版软件源（可以使用 testing 或 unstable）
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ testing main" >> /etc/apt/sources.list.d/google.list'

# 更新软件包列表
RUN apt-get update

# 安装 Google Chrome 的最新版
RUN apt-get install -y google-chrome

# 清理 APT 缓存
RUN rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制应用代码
COPY ./ /app/

# 安装应用依赖
RUN npm install

# 启动应用
CMD npm start
