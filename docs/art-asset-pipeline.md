# 美术资产处理流程

## 目标

所有角色、怪物、背景图都先落到 `image/`，再用 `tools/process_asset.py` 生成游戏实际使用的 `*-clean.png` 和 `*-data.js`。游戏加载优先读 `*-data.js` 注入的 data URI；如果脚本没有引入，才回退读取 PNG。

## 角色图

角色图不要在 Phaser 里拉伸成固定宽高。当前逻辑按贴图原始宽高比显示，固定显示高度由 `DungeonScene.createPlayerSprite()` 控制。

建议处理命令：

```powershell
python tools/process_asset.py image/player-role-3.png `
  --output image/player-role-3-clean.png `
  --mode white `
  --white-tolerance 38 `
  --brightness 200 `
  --erode 1 `
  --trim-alpha `
  --data-js image/player-role-3-data.js `
  --data-kind player
```

如果原图已经是透明 PNG，但边缘有半透明毛边，用 alpha 硬切：

```powershell
python tools/process_asset.py image/player-role-3.png `
  --output image/player-role-3-clean.png `
  --mode alpha-hard `
  --alpha-threshold 200 `
  --trim-alpha `
  --data-js image/player-role-3-data.js `
  --data-kind player
```

## 怪物图

普通怪物可以直接去白底。文件、纸张、报表这类怪物如果内部有白色内容，必须使用 `edge-white`，只清除与图片边缘连通的白底，保留内部白色。

普通去白底：

```powershell
python tools/process_asset.py image/m-feishu-1.png `
  --output image/m-feishu-1-clean.png `
  --mode white `
  --white-tolerance 38 `
  --brightness 200 `
  --erode 1 `
  --trim-alpha `
  --data-js image/m-feishu-1-data.js `
  --data-kind monster `
  --data-key ranged_a
```

保留内部白色：

```powershell
python tools/process_asset.py image/m-nianzhong-1.png `
  --output image/m-nianzhong-1-clean.png `
  --mode edge-white `
  --white-tolerance 38 `
  --brightness 200 `
  --erode 1 `
  --trim-alpha `
  --data-js image/m-nianzhong-1-data.js `
  --data-kind monster `
  --data-key melee_b
```

## 背景图

背景图不抠图，直接生成 data 文件：

```powershell
python tools/process_asset.py image/bg-8-3.png `
  --output image/bg-8-3.png `
  --mode none `
  --data-js image/bg-8-3-data.js `
  --data-kind background `
  --data-key background_8_3
```

背景输出建议：

- 比例：16:9。
- 推荐尺寸：1920x1080 或更高。
- 地面基线：角色和怪物脚底应落在画面高度约 72% 到 76% 的水平区域。
- 不要把前景道具做得过大；左侧清洁工具、办公桌、柜子等应服务比例尺，不能压过角色身高。
- 背景可以是像素风或低清晰度 2D 风格，但要保持透视稳定、地面明确、可行走区域干净。

## 接入检查

新增或替换图片后检查三处：

1. `image/*-data.js` 是否生成并包含正确的全局变量。
2. `index.html` 是否引入对应 data 文件。
3. `BootScene.js` 的加载 key 和 fallback PNG 是否匹配。

如果控制台出现 `Failed to load ... image` 或 `texture missing`，优先检查文件名大小写、`index.html` 是否引入 data 文件，以及 fallback PNG 路径是否真实存在。

## 视觉配置

怪物贴图的显示尺寸集中配置在 `data/monsterVisuals.js`：

- `textureKey`：Phaser 里加载后的纹理 key。
- `displayHeight`：该怪物在游戏里的显示高度，宽度按原图比例自动计算。
- `baselineOffsetY`：所有怪物共用的脚底基线偏移。默认是 `59`，表示怪物贴图脚底相对逻辑中心点向下 59px。
- `preserveInnerWhite`：记录这张图在资产处理时需要保留内部白色，主要用于文件、纸张、表格类怪物。

调整怪物大小时优先改 `displayHeight`。只有确认所有怪物整体都漂浮或下沉时，才改 `baselineOffsetY`。

## 基线调试

局内按 `G` 可以切换视觉调试叠线：

- 蓝线：玩家视觉脚底基线。
- 绿色短线：每个怪物视觉脚底基线。
- 蓝色矩形：玩家逻辑碰撞框。
- 黄色矩形：怪物逻辑碰撞框。

调试时优先看绿色短线是否和蓝线处在同一地面高度；如果线对齐但画面仍不对，通常是背景图透视或贴图自身留白问题。
