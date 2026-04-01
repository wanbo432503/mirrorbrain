# MirrorBrain

[English README](./README.md)

MirrorBrain / 镜像大脑 是 `openclaw` 的 memory 和 capability layer。

它的目标分三层：

- 把经过授权的工作活动采集成 `memory`
- 把 reviewed memory 整理成可读的 `knowledge`
- 把重复工作流沉淀成可复用的 `skill` draft

## 当前进展

这个仓库目前还是一个非常窄的 Phase 1 MVP。

当前已经完成：

- 只支持浏览器来源，通过 `ActivityWatch` + `aw-watcher-web`
- 使用 `OpenViking` 做本地存储和检索
- 提供本地 HTTP 服务和独立 Web UI
- 支持浏览器同步、按天生成 candidate stream、AI review suggestion、reviewed memory、knowledge draft、skill draft 这条最小闭环

当前还没做：

- shell history 采集
- 文档导入
- `openclaw` 对话采集
- 更完整的授权与来源管理界面
- 面向生产环境的部署和运维能力

## Todo

下一阶段最明确的事情是：

- 增加更多经过授权的数据源，而不只限于浏览器
- 提升 review 工作流和生成结果质量
- 把 `openclaw` 的插件边界做得更稳定清晰
- 把本地安装启动流程简化，不再强依赖现在这套较重的 ActivityWatch + OpenViking 组合

更详细的规划文档在 [`docs/plans/`](./docs/plans/)。

## 快速开始

### 1. 前置依赖

你需要先准备好：

- Node.js
- `pnpm`
- 本地运行中的 ActivityWatch
- 浏览器里的 `aw-watcher-web`
- 本地运行中的 OpenViking

默认本地地址：

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. 安装 ActivityWatch

1. 从 `https://activitywatch.net/` 安装 ActivityWatch
2. 启动 ActivityWatch
3. 在你要记录的浏览器中安装 `aw-watcher-web`
4. 打开 ActivityWatch UI，确认已经能看到浏览器 tab 记录

### 3. 安装并启动 OpenViking

安装服务端：

```bash
pip install openviking --upgrade --force-reinstall
```

创建 `~/.openviking/ov.conf`：

```json
{
  "storage": {
    "workspace": "/path_to_workspace/openviking_workspace"
  },
  "log": {
    "level": "INFO",
    "output": "stdout"
  },
  "embedding": {
    "dense": {
      "api_base": "http://<your-model-endpoint>/v1",
      "api_key": "<your-api-key>",
      "provider": "openai",
      "dimension": 1024,
      "model": "<your-embedding-model>"
    },
    "max_concurrent": 10
  },
  "vlm": {
    "api_base": "http://<your-model-endpoint>/v1",
    "api_key": "<your-api-key>",
    "provider": "openai",
    "model": "<your-vlm-model>",
    "max_concurrent": 32
  }
}
```

导出配置并启动服务：

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
openviking-server
```

如果 OpenViking 还没启动成功，就先不要继续。MirrorBrain 依赖它。

### 4. 安装 MirrorBrain

```bash
pnpm install
cp .env.example .env
```

编辑 `.env`，至少确认这几个值和你本机一致：

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
```

### 5. 启动 MirrorBrain

```bash
pnpm dev
```

然后打开：

```text
http://127.0.0.1:3007
```

API 文档入口：

```text
http://127.0.0.1:3007/docs
```

### 6. 验证 MVP 流程

进入网页后依次点击：

1. `Sync Browser Memory`
2. 打开 `Review` tab，点击 `Create Candidate`
3. UI 会默认用昨天本地时间窗口生成 candidate stream，然后选择一个 candidate stream
4. 查看 AI 给出的 review suggestion
5. 点击 `Keep Candidate`
6. 打开 `Artifacts` tab
7. 点击 `Generate Knowledge`
8. 点击 `Generate Skill`

预期结果：

- 页面里能看到 memory events
- 页面会显示一个或多个当天的 candidate stream
- 选中的 candidate 会显示 title、summary 和 suggestion
- 页面显示一个 reviewed memory id
- 页面显示一个 knowledge draft id
- 页面显示一个 skill draft id

## 常用命令

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm e2e
```
