# 视频尺寸转换工具

这个文件夹可以整体压缩后发给别人，核心的 `ffmpeg.wasm` 文件已放在 `vendor/` 目录里。

推荐启动方式：

```bash
./start.command
```

启动后打开：

```text
http://127.0.0.1:8787/
```

也可以直接打开独立版入口：

```bash
open /Users/qiujian/Documents/CodeProjects/Touka/ads-scraw/tools/video-size-converter/index.html
```

如果浏览器限制 `file://` 下的 `ffmpeg.wasm` 或 worker 加载，可以在本目录启动一个静态服务后访问：

```bash
cd /Users/qiujian/Documents/CodeProjects/Touka/ads-scraw/tools/video-size-converter
python3 -m http.server 8787
```

转换规则和当前项目里的素材尺寸修改逻辑保持一致：

- 图片：目标画布固定尺寸，背景 cover 铺满并模糊，前景 contain 居中，输出 PNG。
- 视频：优先用 `ffmpeg.wasm`，filter 为 cover 模糊背景 + contain 前景居中；失败时回退到浏览器 canvas + MediaRecorder。
- 尺寸：默认 `720×1280`，可选 `1280×720`、`800×800` 和 `8～4096` 的自定义尺寸。
