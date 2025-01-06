FROM node:18-bullseye

ENV BUILD=1
ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1

# 更新 apt 源为 https
RUN sed -i 's/http/https/g' /etc/apt/sources.list

# 清理并更新包列表
RUN apt-get clean && apt-get update

# 安装必要的软件包
RUN apt-get install -y wget gnupg ca-certificates procps libxss1 --fix-missing

# 添加 Google 的 GPG 密钥
RUN wget -qO - https://dl.google.com/linux/linux_signing_key.pub | tee /etc/apt/trusted.gpg.d/google.asc

# 添加 Google Chrome 的仓库
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list'

# 更新包列表并安装 Google Chrome
RUN apt-get clean && apt-get update && apt-get install -y google-chrome-stable --fix-missing

# 清理不必要的文件以减小镜像体积
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./ /app/

RUN npm install

CMD ["npm", "start"]
