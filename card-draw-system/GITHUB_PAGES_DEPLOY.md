# GitHub Pages 独立部署版

这个版本放在 `docs/` 目录里，可以直接交给 GitHub Pages 托管。

## 需要上传的文件

把整个 `card-draw-system` 文件夹推到 GitHub 仓库即可。GitHub Pages 只会读取：

- `docs/index.html`
- `docs/styles.css`
- `docs/app.js`
- `docs/static-cards.js`
- `docs/.nojekyll`

## GitHub 上的设置

1. 打开你的 GitHub 仓库。
2. 进入 `Settings`。
3. 左侧选择 `Pages`。
4. `Build and deployment` 选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
5. 点击 `Save`。

等一两分钟后，页面会生成一个类似这样的地址：

```text
https://你的用户名.github.io/仓库名/
```

这个链接就是可以发给她打开的网页。

## 之后怎么更新卡牌

如果你改了 `data/cards.json`，先重新生成前端卡池：

```bash
npm run build:static-cards
```

然后把新的 `public/static-cards.js` 复制到 `docs/static-cards.js`，再推送到 GitHub。

如果只改页面样式或交互，也记得同步改到 `docs/` 里的对应文件。

## 注意

这是纯 GitHub Pages 静态版，没有后端。抽卡记录、收藏夹、使用记录和回忆都保存在她当前浏览器里。
