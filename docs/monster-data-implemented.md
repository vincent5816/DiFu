# 怪物数据表（实装版本）

本页记录当前代码中的首层怪物实装参数，用于和 PRD / Notion 设计表对照。时间单位统一为 `ms`，距离单位为 `px`，数值来源为 `data/enemies/enemies.js` 与当前战斗系统实现。

当前版本已经和原始「怪物数据表 v0.1（结构化）」有几处设计偏移：接触怪已经从纯碰撞威胁改为周期性 AOE 威胁；Boss 普攻参数也按实际手感调低了伤害、范围和冷却。

## 字段说明

| 字段 | 含义 |
| --- | --- |
| `id` | 怪物类型 ID。 |
| `element` | 属性标签。当前近战怪、远程怪、Boss 已配置；接触怪暂未配置。 |
| `hp` | 当前生命值。 |
| `maxHp` | 最大生命值。 |
| `attackType` | 战斗类型：`contact` / `melee` / `ranged` / `boss`。 |
| `damage` / `contactDamage` | 普通伤害或接触伤害。 |
| `attackRange` / `range` / `hitRange` | 攻击触发或命中范围。当前命中判断按角色与怪物视觉边界距离计算。 |
| `aggroRange` | 怪物发现玩家并进入战斗行为的范围。 |
| `moveSpeed` | 追击或行为移动速度。 |
| `patrolRange` | 巡逻范围。 |
| `patrolSpeed` | 巡逻速度。 |
| `idleMs` | 行为循环中的等待时间。 |
| `windupMs` | 攻击前摇。 |
| `attackMs` | 攻击持续时间。 |
| `cooldownMs` | 攻击后冷却。 |
| `projectileSpeed` | 远程投射物速度。 |
| `projectileTtlMs` | 投射物最大存活时间。 |
| `projectileInterval` | 投射物发射间隔。 |
| `panicCooldownOnMelee` | 远程怪被近身攻击后的慌乱冷却。 |
| `aoeRadius` | 接触怪 AOE 半径。实装版本新增字段。 |
| `phase2Threshold` | Boss 进入二阶段的生命比例。 |

暴露给 agent 的战斗事件包括：`ENCOUNTER_ENEMY`、`ENEMY_CHASING`、`ENEMY_WINDUP`、`ENEMY_ATTACKING`、`ENEMY_COOLDOWN`、`PROJECTILE_SPAWNED`、`BOSS_CHARGE_WINDUP`、`BOSS_CHARGING`、`BOSS_STUNNED_A`、`BOSS_NORMAL_WINDUP`、`BOSS_NORMAL_ATTACKING`、`BOSS_NORMAL_COOLDOWN`、`BOSS_TRIPLE_HIT`、`BOSS_STUNNED_B` 等。

---

## 一、接触怪

### 接触怪 A｜地面游荡型 AOE

策略问题：角色进入攻击范围后，如果只站桩攻击，会周期性吃到以怪物自身为圆心的 AOE。该怪会巡逻，被击中后会后退。

```json
{
  "id": "contact_a",
  "hp": 20,
  "maxHp": 20,
  "width": 44,
  "height": 42,
  "attackType": "contact",
  "behavior": "patrol",
  "contactDamage": 10,
  "aoeRadius": 150,
  "aoeWindupMs": 720,
  "aoeAttackMs": 160,
  "aoeCooldownMs": 900,
  "moveSpeed": 60,
  "patrolRange": 130,
  "patrolSpeed": 60,
  "knockbackOnHit": true,
  "knockbackDistance": 80
}
```

状态转换：`IDLE / PATROLLING` → `contact_aoe_windup`（720ms）→ `contact_aoe_attacking`（160ms，结算 AOE 命中）→ `contact_aoe_cooldown`（900ms）→ 循环。

与设计表差异：原设计是纯接触怪，`contactDamage` 为 8，`attackRange / windupDuration / cooldownDuration` 都为 0。实装版本已经改成周期 AOE，伤害为 10，AOE 半径为 150。

### 接触怪 B｜地面定点型 AOE

策略问题：不会主动移动，但会用更大的体型和 AOE 区域压迫角色站位。

```json
{
  "id": "contact_b",
  "hp": 30,
  "maxHp": 30,
  "width": 50,
  "height": 48,
  "attackType": "contact",
  "behavior": "static",
  "contactDamage": 12,
  "aoeRadius": 154,
  "aoeWindupMs": 760,
  "aoeAttackMs": 170,
  "aoeCooldownMs": 950,
  "moveSpeed": 0,
  "patrolRange": 0,
  "patrolSpeed": 0,
  "knockbackOnHit": false
}
```

状态转换：`IDLE` → `contact_aoe_windup`（760ms）→ `contact_aoe_attacking`（170ms，结算 AOE 命中）→ `contact_aoe_cooldown`（950ms）→ 循环。

与设计表差异：原设计是纯接触怪，`contactDamage` 为 10，`attackRange / windupDuration / cooldownDuration` 都为 0。实装版本已经改成周期 AOE，伤害为 12，AOE 半径为 154。

---

## 二、近战怪

### 近战怪 A

策略问题：学习基础后撤和反击节奏。前摇长、冷却长，适合观察并反击。

```json
{
  "id": "melee_a",
  "element": "wood",
  "hp": 90,
  "maxHp": 90,
  "width": 42,
  "height": 54,
  "attackType": "melee",
  "aggroRange": 200,
  "attackRange": 60,
  "range": 60,
  "hitRange": 60,
  "moveSpeed": 80,
  "patrolRange": 90,
  "patrolSpeed": 28,
  "idleMs": 500,
  "windupMs": 1500,
  "attackMs": 200,
  "cooldownMs": 2000,
  "damage": 12
}
```

状态转换：`PATROLLING` → 进入 `aggroRange` → `CHASING` → 进入 `attackRange` → `WINDUP`（1500ms）→ `ATTACKING`（200ms）→ `COOLDOWN`（2000ms）→ 循环。

与设计表差异：设计表 HP 为 30，实装提升为 90。其余核心数值一致。字段名从 `attackDamage / windupDuration / attackDuration / cooldownDuration` 映射为实装字段 `damage / windupMs / attackMs / cooldownMs`。

### 近战怪 B

策略问题：已有的后撤距离不够用了。比近战怪 A 前摇更短、冷却更短、单次伤害更高。

```json
{
  "id": "melee_b",
  "element": "fire",
  "hp": 180,
  "maxHp": 180,
  "width": 44,
  "height": 56,
  "attackType": "melee",
  "aggroRange": 200,
  "attackRange": 200,
  "range": 200,
  "hitRange": 200,
  "moveSpeed": 80,
  "patrolRange": 90,
  "patrolSpeed": 28,
  "idleMs": 500,
  "windupMs": 1000,
  "attackMs": 200,
  "cooldownMs": 1500,
  "damage": 27
}
```

状态转换：同近战怪 A，但 `attackRange` 更大、`windupMs` 更短、`cooldownMs` 更短。

与设计表差异：设计表 HP 为 30，实装提升为 180。设计表 `attackRange` 为 100，实装为 200。其余核心数值一致。

---

## 三、远程怪

### 远程怪 A｜慢速单发

策略问题：在投射物压制下接近并击杀。弹速慢、单发、间隔长。

```json
{
  "id": "ranged_a",
  "element": "wood",
  "hp": 60,
  "maxHp": 60,
  "width": 42,
  "height": 54,
  "attackType": "ranged",
  "range": 300,
  "aggroRange": 300,
  "attackRange": 300,
  "idleMs": 500,
  "windupMs": 0,
  "attackMs": 200,
  "cooldownMs": 1500,
  "damage": 5,
  "projectileSpeed": 150,
  "projectileTtlMs": 2400,
  "projectileInterval": 1500,
  "panicCooldownOnMelee": 800
}
```

状态转换：进入 `aggroRange` → `ATTACKING`（发射 1 发）→ `COOLDOWN`（1500ms）→ 循环；被近身后进入慌乱冷却（800ms）。

与设计表差异：设计表 HP 为 20，实装提升为 60。设计表 `attackDuration` 为 0，实装 `attackMs` 为 200。其余核心数值一致。实装额外增加 `projectileTtlMs`。

### 远程怪 B｜快速连射

策略问题：连续跳跃无法稳定接近，需要识别射击间隙。5 连射，每发间隔 300ms。

```json
{
  "id": "ranged_b",
  "element": "fire",
  "hp": 75,
  "maxHp": 75,
  "width": 44,
  "height": 54,
  "attackType": "ranged",
  "range": 300,
  "aggroRange": 300,
  "attackRange": 300,
  "idleMs": 500,
  "windupMs": 0,
  "attackMs": 1200,
  "cooldownMs": 1800,
  "damage": 3,
  "projectileSpeed": 250,
  "projectileTtlMs": 1800,
  "projectileInterval": 300,
  "burstCount": 5,
  "burstInterval": 300,
  "burstCooldown": 1800,
  "panicCooldownOnMelee": 600
}
```

状态转换：进入 `aggroRange` → 连射 5 发（每发间隔 300ms）→ `COOLDOWN`（1800ms）→ 循环；被近身后进入慌乱冷却（600ms）。

与设计表差异：设计表 HP 为 20，实装提升为 75。设计表 `cooldownDuration` 写 300，但状态说明写连射后冷却 1800ms；实装采用 1800ms。设计表 `attackDuration` 为 0，实装 `attackMs` 为 1200，用来覆盖 5 连射窗口。实装额外增加 `projectileTtlMs`。

---

## 四、Boss｜第一层

策略问题：识别两个眩晕窗口并精确利用。Boss 会冲锋、撞墙硬直、普攻压迫，生命低于 40% 后进入二阶段并使用三连击。

```json
{
  "id": "boss_floor1",
  "element": "metal",
  "hp": 300,
  "maxHp": 300,
  "width": 72,
  "height": 90,
  "attackType": "boss",
  "behavior": "boss_floor1",
  "phase2Threshold": 0.4,
  "moveSpeed": 200,
  "chargeCooldownMs": 12000,
  "chargeWindupMs": 550,
  "chargeSpeed": 400,
  "chargeDamage": 30,
  "stunOnWallMs": 2000,
  "normalAttackDamage": 18,
  "normalAttackRange": 95,
  "normalWindupMs": 1400,
  "normalAttackMs": 200,
  "normalCooldownMs": 900,
  "normalMoveSpeed": 90,
  "repositionMs": 800,
  "preferredGap": 80,
  "phase2TriggerMs": 800,
  "tripleHitCooldownMs": 10000,
  "tripleHitDamage": 15,
  "tripleHitInterval": 400,
  "tripleHitAttackMs": 200,
  "stunAfterTripleMs": 2000
}
```

阶段转换：`hp / maxHp <= 0.4` → `boss_phase2_trigger`（800ms）→ 二阶段可释放三连击。

眩晕触发条件：

- 眩晕 A：冲锋结束后撞墙 → `BOSS_STUNNED_A`（2000ms）。
- 眩晕 B：三连击打完 → `BOSS_STUNNED_B`（2000ms）。

Boss 冲锋状态：`BOSS_CHARGE_WINDUP`（550ms）→ `BOSS_CHARGING`。命中玩家后造成 30 点伤害和击飞，但冲锋不会立即停止，会继续推进直到撞墙或结束。

Boss 普攻状态：`BOSS_NORMAL_WINDUP`（1400ms）→ `BOSS_NORMAL_ATTACKING`（200ms）→ `BOSS_NORMAL_COOLDOWN`（900ms）。

与设计表差异：

- 设计表 `normalAttackDamage` 为 25，实装为 18。
- 设计表 `normalAttackRange` 为 120，实装为 95。
- 设计表 `windupDuration` 为 1200，实装 `normalWindupMs` 为 1400。
- 设计表 `cooldownDuration` 为 1800，实装 `normalCooldownMs` 为 900。
- 设计表未列出 `chargeCooldownMs`、`chargeWindupMs`、`normalMoveSpeed`、`repositionMs`、`preferredGap`、`tripleHitCooldownMs`、`tripleHitAttackMs`，这些是当前实现补充字段。

---

## 待校准

- 接触怪 A/B 已经从原设计的纯接触怪改成 AOE 怪，需要决定是否同步更新 PRD 设计表。
- 接触怪 A/B 暂无 `element` 字段。如果五行克制体系要覆盖全部怪物，需要补齐。
- 近战怪和远程怪的 HP 已按实装体验大幅提高，需要继续观察默认 agent 的击杀耗时是否过长。
- 近战怪 B 的 `attackRange` 当前为 200，明显高于设计表 100，需要确认是保留手感还是回调。
- Boss 普攻当前比设计表更弱但更频繁，需要确认目标体验：高压低频，还是低伤高频。
- 远程怪 B 的 `cooldownDuration` 在设计表中存在语义歧义：JSON 写 300，状态说明写 1800；当前实现采用 1800。
- 所有 `aggroRange / attackRange / aoeRadius` 仍建议在视觉资产确定后重新校准。
