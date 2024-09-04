FROM node:18.17.0-alpine

# 安装依赖库以支持 Chrome
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    libx11 \
    libxcomposite \
    libxrandr \
    libxi \
    libxtst \
    mesa-gl \
    fontconfig

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY ./ /app/

# 安装依赖
RUN npm install

# 启动应用

CMD npm start
