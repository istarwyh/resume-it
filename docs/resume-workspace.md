# 简历工作台：默认版本、岗位定制、投递快照与反馈

## 为什么这样设计

默认简历是一种展示视图，不能代表所有投递。一个岗位版本需要回答：为什么选择这些经历，哪些 JD 要求有证据，哪些仍待确认，以及面试官实际看到了哪份文件。

本阶段保持现有 Gulp / Nunjucks / Stylus 模板，增加无需数据库、无需 AI 的本地 CLI。公开默认页面与私有工作台有明确的存储和发布边界。不会自动投递、联系招聘方、自动更新默认简历或把反馈上传给模型。

| 对象 | 数据来源 / 存储 | 约束 |
| --- | --- | --- |
| 默认事实素材 | `data.yaml`、`data-en.yaml` | 现有内容原样保留；项目增加跨语言共用的稳定 `id`，不因标题修改或排序而变化 |
| 岗位 | 私有 `targets/<id>.json` | JD 原文、来源 URL、采集时间、地点、硬要求；内容摘要关联岗位版本 |
| 岗位简历 | 私有 `variants/<id>.json` | 事实 ID 选材、项目组内排序、表达改写、改写理由及证据 ID；保留公司/时期结构 |
| 导出 | 私有 `exports/<uuid>/` | 当次解析内容、JD、版本、HTML、静态资源、可选 PDF、源文件与哈希清单 |
| 投递快照 | 私有 `submissions/<uuid>/` | 复制当次导出、渠道及实际投递时间；不会随事实或岗位版本变化 |
| 面试反馈 | 私有 `feedback/<uuid>.json` | 关联投递及轮次；原话、观察、推断分开；表达/证据/技能/岗位匹配/未知分类 |
| 修改决定 | 私有 `decisions/<feedback-id>.json` | 明确采纳/拒绝、操作者和理由；采纳只改目标版本，且重新进入待审阅状态 |

事实素材目前复用现有双语 YAML，避免一次迁移拆碎所有字段造成内容回归。项目 URL 可作为佐证入口，但现有简历中的描述不等于已独立验证的事实。`catalog` 明确标为待人工核实。数字口径、管理范围和“借助已有 Runtime”与“自研 Runtime”的区别，仍需本人审阅；程序只验证引用存在，不能证明文字真实。中英文共用项目 ID，但翻译依然人工维护；任一语言源文件修改都会使已有岗位版本过期。

## 快速开始

需要 Node.js 22+。安装依赖后：

```bash
npm install
# 使用仓库之外的目录；不要放在公共云盘或公开 Web 根目录。
export RESUME_WORKSPACE="$HOME/.local/share/resume-it"
npm run resume -- init
npm run resume -- catalog --locale zh
```

工作台必须在仓库外，且不能是仓库祖先。会解析路径中的符号链接，避免别名绕过检查。记录默认以 `0600` 创建，目录 `0700`；这不是加密，不替代磁盘权限与加密备份。

### 1. 录入岗位及要求

复制 `examples/target.json` 到私有目录，替换为真实 JD（示例是虚构岗位，不代表招聘仍开放）。要求列表里的 `hard` 只根据 JD 明确措辞填写，不把偏好当硬门槛。

```bash
npm run resume -- target company-agent --input /absolute/private/target.json
npm run resume -- variant company-agent-zh --target company-agent --locale zh
```

编辑 `$RESUME_WORKSPACE/variants/company-agent-zh.json`：

- `projectIds`：从 `catalog` 中选取。按所列顺序排列同一雇主/项目组中的项目，不改变雇主及时间线；其他个人资料和技能默认沿用源文件。
- `reason`：为什么这样选材。
- `requirementMapping`：覆盖每个要求；`supported`、`partial`、`unknown`，记录 `evidenceIds` 和说明。没有证据填写 `unknown`，不等于断言没有能力。
- `overrides`：可改 `description`、`apply_to_position`，以及 `project:<id>` 的描述。每项需要 `text`、`reason`、`evidenceIds`。描述支持 Markdown，岗位名是纯文本。

例如：

```json
{
  "description": {
    "text": "专注 Agent 运行链路、工具编排及生产评测。",
    "reason": "用已具备的工程经历回应岗位关注点",
    "evidenceIds": ["insurance-quick-check", "mcp-toolchain"]
  }
}
```

不要直接替换整份 variants 文件：保留生成的 `schemaVersion`、`id`、`targetId`、`baseHash`、`targetHash`、`locale`。

### 2. 对照、审阅、导出

```bash
npm run resume -- inspect company-agent-zh
npm run resume -- review company-agent-zh --reviewer "本人姓名"
npm run resume -- build company-agent-zh
# 生成实际 PDF（先安装浏览器；Linux 还需要中文字体）
npx playwright install chromium
npm run resume -- build company-agent-zh --pdf
```

`inspect` 展示原文/改写、证据、选择和源数据/JD是否变化。`review` 是本人对选材和事实边界的确认，不是自动判断匹配。任何后续编辑都会使 review 摘要不匹配，拒绝导出。源文件或 JD 变化后，先人工比较，再执行：

```bash
npm run resume -- refresh company-agent-zh --reason "已对比 JD / 双语事实修改；说明处理方式"
npm run resume -- review company-agent-zh --reviewer "本人姓名"
```

不会自动合并覆盖定制表述。保留原哈希和刷新理由。多个岗位与语言版本独立审阅。

导出命令返回 `exportId` 和目录。直接打开其中的 `index.html` / `index-en.html` 检查，再查看 PDF。私有预览使用 CSP 禁止网络请求、关闭分析脚本；仅生成当前语言，隐藏另一语言入口。打印继续使用共享模板和自然 A4 分页，不压缩成一页。浏览器导出还会主动阻断 HTTP(S) 请求。外链图片会缺省，链接本身仍可由你点击访问。

HTML 预览用于本人审阅，投递时只发送 `resume.pdf`，不要把整个导出目录交给对方——目录内包含私有 JD、审阅信息和完整事实素材。

### 3. 记录已经发生的投递

```bash
npm run resume -- snapshot export-返回的UUID --channel "email" --at "2026-10-26T10:00:00+08:00"
npm run resume -- verify submission-返回的UUID
```

只允许对含 PDF 且哈希校验通过的导出创建投递记录。生成文件本身不代表投递成功。返回的 submission ID 用来关联反馈。UUID 避免同日覆盖；snapshot 复制真实 PDF 和所有资产，以内容哈希检测修改，不依赖日后重新安装依赖才能找回原始文件。

命令不提供修改旧快照的入口；普通文件系统仍可被手工修改，`verify` 能检测与原清单不一致，但不是防恶意重写清单的签名系统。备份应包含完整工作台，而不只是 variants。构建记录包含 Git commit、工作区是否有未提交修改、模板摘要、Node/Playwright 版本及实际源文件/依赖清单。

### 4. 面试反馈 → 修改提案 → 再次审阅

```bash
npm run resume -- feedback submission-UUID --input /absolute/private/feedback.json
npm run resume -- decide feedback-UUID --decision accept --reviewer "本人姓名" --reason "核实后采纳"
# 或 --decision reject；拒绝保留记录，不修改简历。
npm run resume -- review company-agent-zh --reviewer "本人姓名"
```

`examples/feedback.json` 是明确标注的虚构反馈。真实反馈要记录面试轮次、观察、分类、置信度，可补充原话和推断。不要把推断填成面试官原话。提案可改变选材、表达、理由、要求映射；不允许更改目标岗位、事实源、投递时间或旧快照。

提案记录当前版本摘要；提案之后版本又改变时，采纳会报冲突，需要重新对照并创建新提案。接受后 review 清空。系统先保存决定，再应用版本修改；若中途进程退出，可用 `recover-decision <feedback-id>` 恢复，且不会覆盖已经发生的其他修改。相同提案不能重复决定。

表达问题可以调整版本；事实/指标错误应单独修改源 YAML并审阅两种语言；技能缺口应形成学习/项目行动；岗位不匹配不应通过编造经历解决。单次拒绝不能证明能力不足，少量样本也不能证明某版简历提高转化率。

## 两个独立示例

```bash
export RESUME_WORKSPACE="$HOME/.local/share/resume-it-demo"
npm run demo
npm run resume -- inspect demo-agent-zh
npm run resume -- inspect demo-backend-en
```

创建中文 Agent 与英文 Backend 两个不同选材的未审阅版本，复用同一事实源。命令不会虚构已投递/面试记录；重复运行拒绝覆盖已有 ID。

## 发布边界

`npm run build` 仅从仓库默认 YAML 生成 `dist/index.html`、`print.html`、`index-en.html`、`print-en.html`，不读取 `RESUME_WORKSPACE`。构建会清理旧 dist，并生成公开资产清单。`publish.ts` 在联网前验证清单哈希、必需页面和路径白名单；出现额外文件或篡改会失败。

`npm run publish` 会重新构建并强制推送 gh-pages，仍须由你主动执行。本次工作台功能不会发布岗位版本。`noindex` 不是权限控制；私有文件始终不进入公开部署。`npm start` 热更新会使发布清单过期，直接运行 publish.ts 会拒绝；通过正式 publish 命令重新构建即可。

## 迁移、备份与回退

- 原 YAML 只增加稳定项目 ID，默认输出内容、4 个入口和样式保持兼容。不必一次迁移旧档案。
- 日常 build/start 不再隐式复制日期档案；历史 archive 保留只读。新投递用显式 snapshot。
- 不要复制模板重复维护；所有版本复用 `resume-content.html`。
- 本地编辑的私有 JSON 属于受信任输入：不要导入来源不明的脚本/HTML；CLI不是多用户服务。
- 加密备份整个工作台到仅本人可访问的位置。恢复时设置新的绝对路径，执行 `verify` 检查每份投递；之后 inspect/refresh/review 可编辑版本。
- 回退代码只需回退本 PR；新增项目 ID 不影响旧模板。保留独立工作台和导出的 PDF，不删除源记录。schemaVersion 未支持时程序明确拒绝，而非尝试猜测转换。

## 验收与后续

```bash
npm test
npm run test:browser
npm run test:workspace-browser
```

测试覆盖两种语言默认内容、两个不同岗位版本、非法/重复引用、审阅失效、来源/JD变化、路径隔离、同日多次投递、篡改检测、反馈冲突/拒绝/恢复、公开输出隐私哨兵，以及实际 PDF 的内容和分页。

后续独立迭代：字段级证据/指标口径与来源等级、更细的双语一致性检查、可视化 JD 对照和反馈编辑、三方合并界面、可选 AI 建议。当前只提供项目粒度事实和文本改写，不声称已完成这些后续功能。先用真实投递反馈验证工作流，再决定是否需要数据库、UI 或模型。
