# EdgeOne Pages 零成本部署说明

这个项目已经准备成 EdgeOne Pages 可部署结构：

- `public/`：女朋友访问的前端页面和你的后台页面
- `edge-functions/`：线上后端 API
- `edge-functions/_shared/api.js`：抽卡、收藏、使用记录、自定义卡、后台管理逻辑
- EdgeOne KV：线上持久化保存 `cards` 和 `state`

## 1. 创建 EdgeOne Pages 项目

1. 打开 EdgeOne Pages 控制台。
2. 新建 Pages 项目，选择连接 Git 仓库或上传项目。
3. 项目根目录选择 `card-draw-system` 这个目录。
4. 构建命令留空，或者填 `echo no build needed`。
5. 输出目录填 `public`。

## 2. 开启并绑定 KV

1. 在 EdgeOne Pages 里开启 KV Storage。
2. 创建一个 KV namespace，例如 `love-card-kv`。
3. 把它绑定到当前 Pages 项目。
4. 绑定变量名必须填：

```text
LOVE_KV
```

线上函数会通过 `LOVE_KV` 读写：

- `cards`：90 张卡池
- `state`：抽卡历史、收藏夹、自定义卡、使用记录、额外抽卡机会

首次访问 `/api/state` 时，如果 KV 里还没有数据，会自动初始化 90 张卡和空状态。

## 3. 部署后访问地址

部署完成后：

- 前台：`https://你的项目域名/`
- 后台：`https://你的项目域名/admin.html`
- 后台口令：`520520`

## 4. 注意事项

- EdgeOne KV 是最终一致性存储，官方说明通常会在约 60 秒内同步到全球节点；这个项目只有你女朋友一个主要用户，完全够用。
- 不要把后台链接公开给别人。
- 如果你想换后台口令，修改 `edge-functions/_shared/api.js` 里的 `ADMIN_KEY`，重新部署即可。
- 本地 `server.js` 版本仍然保留，可以继续在电脑上调试；线上 EdgeOne 版本不依赖你电脑开机。

## 5. 本地检查

部署前可以运行：

```bash
npm run check
```

这只检查语法，不会连接 EdgeOne KV。
