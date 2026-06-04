class ReplayFormatter {
  static formatEvent(event) {
    return `${event.time}ms  第${event.floor}层 ${event.roomId}  ${ReplayFormatter.getEventLabel(event.type)}  ${ReplayFormatter.formatDetails(event.details)}`;
  }

  static getEventLabel(type) {
    const labels = {
      COMMAND_EXECUTED: '执行指令',
      COMBAT_THREAT_IGNORED: '战斗威胁未响应',
      BOSS_CHARGE_HIT: 'Boss 冲锋命中',
      BOSS_CHARGE_WINDUP: 'Boss 冲锋前摇',
      BOSS_CHARGING: 'Boss 冲锋',
      BOSS_NORMAL_ATTACKING: 'Boss 普攻',
      BOSS_NORMAL_COOLDOWN: 'Boss 普攻冷却',
      BOSS_NORMAL_HIT: 'Boss 普攻命中',
      BOSS_NORMAL_MISSED: 'Boss 普攻落空',
      BOSS_NORMAL_WINDUP: 'Boss 普攻前摇',
      BOSS_PHASE2_TRIGGER: 'Boss 进入二阶段',
      BOSS_STUNNED_A: 'Boss 撞墙眩晕',
      BOSS_STUNNED_B: 'Boss 连击硬直',
      BOSS_TRIPLE_HIT: 'Boss 三连击',
      ENCOUNTER_CHEST: '遭遇宝箱',
      ENCOUNTER_ENEMY: '遭遇怪物',
      ENCOUNTER_LOOT: '遭遇掉落',
      ENCOUNTER_RETURN_POINT: '遭遇返回点',
      ENEMY_ATTACKING: '怪物攻击',
      ENEMY_ATTACK_MISSED: '怪物攻击落空',
      ENEMY_CONTACT_HIT: '怪物接触伤害',
      ENEMY_COOLDOWN: '怪物冷却',
      ENEMY_DIED: '怪物死亡',
      ENEMY_KNOCKBACK: '怪物被击退',
      ENEMY_WINDUP: '怪物前摇',
      EVENT: '事件',
      PLAYER_ATTACKED: '玩家攻击',
      PLAYER_ATTACK_FAILED: '玩家攻击失败',
      PLAYER_DAMAGED: '玩家受伤',
      PLAYER_DODGED: '玩家闪避',
      PROJECTILE_RESPONSE_WINDOW_ENTERED: '投射物进入响应距离',
      PROJECTILE_SPAWNED: '投射物生成',
      RETURN_POINT_DISCOVERED: '发现返回点',
      RETURN_POINT_DISTANCE_CHANGED: '返回点距离变化',
      STATE_BAG_FULL: '背包已满',
      STATE_COMBAT_THREAT: '战斗威胁',
      STATE_HP_LOW: '血量过低',
      STATE_NEW_ROOM: '进入新房间',
      VISION_ENTITY_ENTERED: '实体进入视野'
    };

    return labels[type] || type;
  }

  static formatDetails(details) {
    if (!details) {
      return '';
    }

    return Object.entries(details)
      .filter((entry) => entry[1] !== null && entry[1] !== undefined)
      .map(([key, value]) => `${ReplayFormatter.getDetailLabel(key)}=${ReplayFormatter.formatValue(key, value)}`)
      .join(' ');
  }

  static formatDetailsPreview(details, maxEntries = 4) {
    if (!details) {
      return '';
    }

    return Object.entries(details)
      .filter((entry) => entry[1] !== null && entry[1] !== undefined)
      .slice(0, maxEntries)
      .map(([key, value]) => `${ReplayFormatter.getDetailLabel(key)}=${ReplayFormatter.formatValue(key, value)}`)
      .join(' ');
  }

  static getDetailLabel(key) {
    const labels = {
      action: '指令',
      amount: '数值',
      attackType: '攻击类型',
      burstCount: '连射总数',
      burstIndex: '连射序号',
      baseAmount: '原始伤害',
      damageType: '伤害类型',
      defended: '防御减伤',
      distance: '距离',
      entityId: '实体',
      eventType: '事件',
      hp: '血量',
      hitCount: '连击总数',
      hitIndex: '连击序号',
      hitRange: '命中范围',
      itemId: '物品',
      projectileId: '投射物',
      projectileType: '投射物类型',
      range: '范围',
      reason: '原因',
      remainingMs: '剩余时间',
      responseDelayMs: '响应延迟',
      responseDistance: '响应距离',
      responseElapsedMs: '实际等待',
      sourceId: '来源',
      sourceType: '来源类型',
      targetId: '目标',
      targetHp: '目标血量',
      targetMaxHp: '目标血量上限',
      threatType: '威胁类型',
      type: '类型'
    };

    return labels[key] || key;
  }

  static formatValue(key, value) {
    if (key === 'action') {
      return ReplayFormatter.getActionLabel(value);
    }
    if (key === 'attackType') {
      return value === 'ranged' ? '远程' : value === 'melee' ? '近战' : value === 'charge' ? '冲锋' : value === 'contact' ? '接触' : value === 'boss_charge' ? 'Boss 冲锋' : value === 'boss_normal' ? 'Boss 普攻' : value === 'boss_triple' ? 'Boss 三连击' : value;
    }
    if (key === 'damageType') {
      return value === 'projectile' ? '投射物' : value === 'melee' ? '近战' : value === 'charge' ? '冲锋' : value === 'contact' ? '接触' : value === 'boss_charge' ? 'Boss 冲锋' : value === 'boss_normal' ? 'Boss 普攻' : value === 'boss_triple' ? 'Boss 三连击' : value;
    }
    if (key === 'distance' || key === 'responseDistance') {
      return ReplayFormatter.getDistanceLabel(value);
    }
    if (key === 'eventType' || key === 'threatType') {
      return ReplayFormatter.getEventLabel(value);
    }
    if (key === 'reason') {
      return ReplayFormatter.getReasonLabel(value);
    }
    if (key === 'sourceType' || key === 'type') {
      return ReplayFormatter.getEntityTypeLabel(value);
    }
    return value;
  }

  static getEntityTypeLabel(type) {
    if (!globalThis.EnemyData || !globalThis.EnemyData[type]) {
      return type;
    }

    return `${StrategyConfig.getEnemyDisplayName(type)} (${type})`;
  }

  static getActionLabel(action) {
    const labels = {
      ATTACK: '攻击',
      DASH: '冲刺',
      DEFEND: '防御',
      DISCARD: '丢弃',
      DOUBLE_JUMP: '二段跳',
      DROP: '丢弃',
      JUMP: '跳跃',
      MOVE: '移动',
      OPEN: '打开',
      PICKUP: '拾取',
      RETREAT: '返回',
      SKIP: '跳过',
      USE_SKILL: '使用技能',
      WAIT: '等待'
    };

    return labels[action] || action;
  }

  static getDistanceLabel(distance) {
    const labels = {
      near: '近',
      mid: '中',
      far: '远'
    };

    return labels[distance] || distance;
  }

  static getReasonLabel(reason) {
    const labels = {
      already_jumping: '正在跳跃',
      dash: '冲刺',
      jump: '跳跃',
      out_of_range: '超出范围',
      response_disabled: '配置为不响应'
    };

    return labels[reason] || reason;
  }
}

window.ReplayFormatter = ReplayFormatter;
