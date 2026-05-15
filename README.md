# MITI 人格测试项目

这是一个用 Vue + Vite 写的纯前端人格测试小项目。用户回答一组左右倾向题后，系统会根据五个维度计算结果，并匹配最接近的角色卡。

## 1. 如何启动项目

### 第一步：安装 Node.js

这个项目需要 Node.js。你可以先在终端里输入：

```bash
node -v
npm -v
```

如果能看到版本号，说明已经安装好了。

如果提示找不到命令，需要先安装 Node.js。安装完成后，重新打开终端再试一次。

### 第二步：安装项目依赖

在项目文件夹里运行：

```bash
npm install
```

这一步会根据 [package.json](package.json) 下载项目需要的依赖。

### 第三步：启动开发服务器

运行：

```bash
npm run dev
```

终端里会出现一个本地访问地址，通常长得像：

```text
http://localhost:5173/
```

把这个地址复制到浏览器里打开，就能看到项目页面。

### 第四步：打包检查

如果你改完代码，建议运行：

```bash
npm run build
```

如果没有报错，说明项目至少可以正常打包。

## 2. 项目里哪些文件最常改

常用文件如下：

- [src/data/questions.json](src/data/questions.json)：问卷题目、左右选项、每个选项对应的分数。
- [src/data/characters.json](src/data/characters.json)：角色信息、角色画像、结果页文案。
- [src/assets/characters/](src/assets/characters/)：角色图片。
- [src/App.vue](src/App.vue)：主要页面逻辑和页面结构。
- [src/style.css](src/style.css)：页面样式。

如果你只是想增加题目或角色，大多数时候只需要改前两个 JSON 文件。

## 3. 五个维度是什么意思

当前测试使用五个维度：

| 字段 | 含义 |
| --- | --- |
| `memory` | 记录、过去、记忆、证据 |
| `control` | 掌控、剧本、秩序、预判 |
| `risk` | 冒险、赌局、突破、变量 |
| `logic` | 理性、知识、推导、诊断 |
| `mask` | 面具、身份、表演、伪装 |

题目的选项会给这些维度加分。最后系统会把用户的五维结果和每个角色的五维画像进行比较，找出最接近的角色。

## 4. 如何增加一道题目

打开 [src/data/questions.json](src/data/questions.json)。里面是一个数组，每一段 `{ ... }` 就是一道题。

一题大概长这样：

```json
{
  "id": "q13",
  "text": "面对一个未知机会时，你更接近哪种反应？",
  "leftLabel": "先收集信息，再决定要不要行动",
  "rightLabel": "先试试看，再根据反馈调整",
  "leftScores": { "logic": 2, "control": 1 },
  "rightScores": { "risk": 2, "mask": 0.5 }
}
```

字段解释：

- `id`：题目的唯一编号。不要和已有题目重复。比如已有 `q1` 到 `q12`，新题可以叫 `q13`。
- `text`：题目正文。
- `leftLabel`：左边选项的文案。
- `rightLabel`：右边选项的文案。
- `leftScores`：用户偏向左边时，会增加哪些维度。
- `rightScores`：用户偏向右边时，会增加哪些维度。

### 分数怎么写

分数可以理解成“这个选项更像哪种人格倾向”。

例如：

```json
"leftScores": { "logic": 2, "control": 1 }
```

意思是：如果用户偏向左边，就更偏向 `logic` 和 `control`，其中 `logic` 更强。

常用分数建议：

- `2`：这个选项非常明显地指向这个维度。
- `1`：这个选项比较明显地指向这个维度。
- `0.5`：这个选项稍微带一点这个维度。
- `-1`：这个选项会轻微削弱某个维度。新手不熟悉时可以先少用负数。

### 注意 JSON 格式

JSON 对格式比较严格：

- 字符串必须用英文双引号 `"`。
- 每个字段之间要有英文逗号 `,`。
- 最后一项后面不要多写逗号。
- 花括号 `{}` 和中括号 `[]` 要成对出现。

如果页面起不来，常见原因就是 JSON 少了逗号、引号或括号。

## 5. 如何增加一个新角色

打开 [src/data/characters.json](src/data/characters.json)。里面每一段 `{ ... }` 就是一个角色。

可以复制一个已有角色，然后改成自己的新角色。

示例：

```json
{
  "id": "new-character",
  "name": "新角色",
  "titleCn": "角色中文称号",
  "titleEn": "TITLE",
  "core": "一句话概括这个角色",
  "direction": "给图片或视觉设计用的关键词。",
  "image": "/src/assets/characters/new-character.png",
  "theme": "#6a84d8",
  "profile": {
    "memory": 0.2,
    "control": 0.7,
    "risk": 0.4,
    "logic": 0.9,
    "mask": 0.3
  },
  "report": {
    "overview": "这里写结果页的人格概览。",
    "similarities": [
      "这里写相似点 1。",
      "这里写相似点 2。",
      "这里写相似点 3。"
    ],
    "strengths": [
      "这里写优势 1。",
      "这里写优势 2。",
      "这里写优势 3。"
    ],
    "blindspots": [
      "这里写盲点 1。",
      "这里写盲点 2。",
      "这里写盲点 3。"
    ],
    "advice": "这里写给这个结果的一句话建议。"
  }
}
```

字段解释：

- `id`：角色唯一编号，只用英文、小写、数字和连字符比较安全，比如 `new-character`。
- `name`：角色名字。
- `titleCn`：中文称号。
- `titleEn`：英文短标题，会显示在卡片上。
- `core`：一句话说明这个角色的核心气质。
- `direction`：视觉关键词，可以写给自己或画图时参考。
- `image`：角色图片路径。
- `theme`：角色主题色，使用十六进制颜色，例如 `#6a84d8`。
- `profile`：角色的五维画像。
- `report`：结果页展示的详细分析文案。

### profile 怎么写

`profile` 是角色的五维数值，每个值建议写在 `0` 到 `1` 之间。

例如：

```json
"profile": {
  "memory": 0.2,
  "control": 0.7,
  "risk": 0.4,
  "logic": 0.9,
  "mask": 0.3
}
```

这表示这个角色：

- `logic` 很高；
- `control` 比较高；
- `risk` 中等；
- `memory` 和 `mask` 较低。

建议不要把所有维度都写得差不多。角色最好有明显高低，这样测试结果更容易区分。

## 6. 如何给新角色添加图片

把图片放进：

[src/assets/characters/](src/assets/characters/)

比如你放了一张：

```text
src/assets/characters/new-character.png
```

那么角色里的 `image` 就写：

```json
"image": "/src/assets/characters/new-character.png"
```

图片文件名建议使用英文、小写、连字符，不要用空格。例如：

```text
new-character.png
```

不太建议：

```text
新 角色 图片.png
```

这样可以减少路径出错的概率。

## 7. 题目和角色如何对应

这个项目不是“某道题直接对应某个角色”，而是通过五个维度间接匹配。

流程是：

1. 用户回答题目。
2. 每道题根据左右选项给五个维度加分。
3. 系统得到用户的五维倾向。
4. 系统拿用户的五维倾向和每个角色的 `profile` 对比。
5. 距离最近的角色就是最终结果。

所以如果你想让某个角色更容易被匹配到，需要同时注意两件事：

### 第一：角色 profile 要清楚

例如你想做一个“高理性、高掌控、低冒险”的角色，可以写：

```json
"profile": {
  "memory": 0.3,
  "control": 0.9,
  "risk": 0.2,
  "logic": 0.9,
  "mask": 0.3
}
```

### 第二：题目里要有能测出这些维度的选项

例如需要有一些选项会给 `logic`、`control` 加分：

```json
"leftScores": { "logic": 2, "control": 1 }
```

如果题目里几乎没有 `logic` 相关选项，那么高理性角色就很难被准确匹配到。

## 8. 修改后怎么检查有没有写错

建议每次改完之后运行：

```bash
npm run build
```

如果成功，会看到类似：

```text
✓ built
```

如果失败，先看报错里提到的文件名和行号。JSON 报错通常是：

- 少了逗号；
- 多了逗号；
- 少了双引号；
- 括号没有闭合；
- 使用了中文逗号 `，` 而不是英文逗号 `,`。

## 9. 如何把自己的修改提交到 GitHub

下面是给完全没用过 GitHub 的人的版本。

### Git 和 GitHub 是什么

- Git：记录代码修改历史的工具。
- GitHub：放代码的网站，可以把你的修改上传到网上，也可以和别人协作。

你可以把 Git 理解成“本地存档”，GitHub 理解成“云端仓库”。

### 第一步：确认当前改了哪些文件

在项目文件夹运行：

```bash
git status
```

它会告诉你哪些文件被修改了。

### 第二步：把想提交的文件加入暂存区

比如你改了题目和角色，可以运行：

```bash
git add src/data/questions.json src/data/characters.json
```

如果你还改了 README，可以加上：

```bash
git add README.md
```

如果你确定所有修改都要提交，也可以运行：

```bash
git add .
```

但新手要注意：`git add .` 会把当前目录下所有改动都加进去。如果里面有不想上传的文件，就不要用这个。

### 第三步：创建一次提交

运行：

```bash
git commit -m "更新问卷和角色"
```

双引号里的文字是这次修改的说明。建议写清楚你做了什么，例如：

```bash
git commit -m "新增角色和测试题目"
```

### 第四步：上传到 GitHub

运行：

```bash
git push
```

如果是第一次上传某个新分支，终端可能提示你运行一条更长的命令，例如：

```bash
git push --set-upstream origin 分支名
```

照着提示复制运行即可。

### 第五步：在 GitHub 上查看

上传成功后，打开你的 GitHub 仓库页面，就能看到刚刚提交的修改。

## 10. 如果你是要给别人的项目贡献修改

如果这个项目不是你的，而是别人的，你通常需要走 Pull Request，也就是“请求对方合并你的修改”。

大致流程是：

1. 在 GitHub 页面点 Fork，把项目复制一份到你的账号下。
2. 把你账号下的项目下载到本地。
3. 在本地修改文件。
4. 用 `git add` 和 `git commit` 保存修改。
5. 用 `git push` 上传到你自己的 GitHub 仓库。
6. 回到 GitHub 页面，点击 Compare & pull request。
7. 写清楚你改了什么，然后提交 Pull Request。
8. 等项目维护者审核。

如果你只是自己玩、自己改自己的项目，不需要 Pull Request，直接 `git push` 就可以。

## 11. 推荐的新手修改流程

每次改项目，可以按这个顺序来：

1. 启动项目：`npm run dev`。
2. 修改 [src/data/questions.json](src/data/questions.json) 或 [src/data/characters.json](src/data/characters.json)。
3. 在浏览器里刷新页面，看效果。
4. 运行：`npm run build`。
5. 运行：`git status`。
6. 运行：`git add 你改过的文件`。
7. 运行：`git commit -m "写一句修改说明"`。
8. 运行：`git push`。

## 12. 常见问题

### 页面打不开怎么办

先确认你运行了：

```bash
npm run dev
```

然后看终端里显示的本地地址，复制到浏览器打开。

### 改了 JSON 后项目报错怎么办

优先检查：

- 是不是少了英文逗号；
- 是不是用了中文逗号；
- 字符串是不是用了英文双引号；
- 最后一项后面是不是多了逗号；
- 括号是不是成对。

### 新角色图片不显示怎么办

检查三件事：

1. 图片是否真的放在 [src/assets/characters/](src/assets/characters/) 里。
2. `characters.json` 里的 `image` 路径是否和图片文件名完全一致。
3. 文件名大小写是否一致。

### 为什么我新增角色后很难测出来

通常是因为：

- 新角色的 `profile` 和已有角色太像；
- 题目没有覆盖这个角色的高维度；
- 题目分数太平均，导致结果区分度不够。

可以让新角色的 `profile` 更有特点，也可以增加几道能测出对应维度的题。
