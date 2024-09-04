FROM node:18-buster

# 设置环境变量以避免 apt-key 警告
ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1

# 更新源并安装必要的工具和库
RUN sed -i 's/http/https/g' /etc/apt/sources.list && \
    apt-get clean && \
    apt-get update && \
    apt-get install -y wget gnupg ca-certificates --fix-missing && \
    wget -qO - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY ./ /app/

# 安装 Node.js 依赖
RUN npm install

# 默认命令
CMD ["npm", "start"]
