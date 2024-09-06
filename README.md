# 谷歌订单爬虫服务

## 开发环境

在项目根目录下配置 `.env` 文件中的账号和密码后，可以通过以下命令启动项目：

```bash
npm run dev
```

###.env 文件示例：<br/>
```
USER_NAME=XXX@nibirutech.com
USER_PASSWORD=XXXX
ACCOUNT_ID=5185069862310717718
```

##功能描述
该服务通过谷歌账号登录，按照用户输入的订单号爬取订单信息。

##代码仓库
Git 仓库地址：https://git.tap4fun.com/bi-web/gporder
接格式**: 将 Git 仓库地址放在单独的部分，并使用超链接格式，使其更易于访问和识别。

##注意
🚫不可登录过于频繁，否则会导致绑定的手机号收不到验证码 或 登录时需要识别图像验证码。
