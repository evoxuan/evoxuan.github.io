# evoxuan 的个人博客

博客地址：https://evoxuan.github.io

这个博客包括首页、文章页、归档和关于页面，支持手机阅读。内容使用 Markdown 保存，更新到 `main` 分支后由 GitHub Actions 自动发布。无需安装依赖或购买服务器。

## 发布新文章

1. 打开仓库里的 `posts` 文件夹。
2. 点击 **Add file → Create new file**。
3. 文件名使用 `年-月-日-英文短名称.md`，例如 `2026-10-04-reading-notes.md`。
4. 粘贴下面的格式，修改标题、简介、分类和正文。
5. 点击 **Commit changes**，保存到 `main`。等仓库的 **Actions** 显示绿色成功后，刷新博客。

```markdown
---
title: 我的阅读笔记
description: 这篇文章的一句话介绍。
category: 阅读
---

这里是文章正文。

## 一个小标题

可以写普通段落，也可以使用 **加粗**、列表、图片和链接。
```

文件名日期用于显示和排序，不是定时发布设置。文件名中的英文短名称用于文章网址；发表后建议保留文件名，以免原链接失效。

`description` 和 `category` 可以省略。标题必填。元信息每项写在一行，值可以写成普通文本或用引号括起来；暂不支持 YAML 多行字段。若要在元信息中使用引号，建议使用双引号并按 JSON 规则转义。

在头部添加 `draft: true` 可让文章不显示在网页上，但公开仓库中的原文件仍可见。私人草稿请保存在自己的电脑上。

## 修改名称和介绍

编辑 `site.json`，修改 `title`（博客标题）、`name`（显示名称）、`description`（首页简介）。文件使用 JSON 格式，保留双引号和逗号。

编辑 `about.md`，修改“关于”页面。首次搭建保留了中性占位介绍，没有代写个人经历。

## 添加图片

将图片上传到 `public/images` 文件夹。正文中写：

```markdown
![图片说明](/images/example.jpg)
```

## 本地预览

安装 Node.js 22 或更新版本后，在这个文件夹里依次运行：

```text
node build.mjs
node preview.mjs
```

然后打开 http://127.0.0.1:4173。修改文章后，重新运行构建并刷新页面。

## 发布设置

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

仓库中已经提供 `.github/workflows/pages.yml`。它会生成 `_site` 文件夹，并用 GitHub 官方发布工具上线。`_site` 是构建产物，不需要手动编辑或提交。

## 文件说明

- `posts/`：文章原稿。
- `about.md`：关于页面。
- `site.json`：博客名称和介绍。
- `public/`：样式、图标和图片。
- `build.mjs`：从 Markdown 生成网页。
- `vendor/`：随项目保存的 Marked 17.0.5（MIT 许可），用于处理 Markdown。

示例文章可以修改或删除。博客不带评论、账号登录或访问统计。
