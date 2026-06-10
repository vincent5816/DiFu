class ReplayFormatter {
  static formatEvent(event) {
    return `${event.time}ms  第${event.floor}层 ${event.roomId}  ${ReplayFormatter.getEventLabel(event.type)}  ${ReplayFormatter.formatDetails(event.details)}`;
  }

  static getEventLabel(type) {
    const labels = {
      COMMAND_EXECUTED: '执行指令',
      COMBAT_THREAT_IGNORED: '战斗威胁未响应',
      BOSS_RETURN_POINT_UNLOCKED: 'Boss 掉落解锁',
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
      ENCOUNTER_HEAL_POINT: '遭遇回复点',
      ENCOUNTER_LOOT: '遭遇掉落',
      ENCOUNTER_PAPER_MONEY: '遭遇纸钱',
      ENCOUNTER_RETURN_POINT: '遭遇返回点',
      ENEMY_ATTACKING: '怪物攻击',
      ENEMY_ATTACK_MISSED: '怪物攻击落空',
      ENEMY_CONTACT_AOE_HIT: '接触怪 AOE 命中',
      ENEMY_CONTACT_AOE_MISSED: '接触怪 AOE 落空',
      ENEMY_CONTACT_HIT: '怪物接触伤害',
      ENEMY_COOLDOWN: '怪物冷却',
      ENEMY_DIED: '怪物死亡',
      ENEMY_KNOCKBACK: '怪物被击退',
      ENEMY_WINDUP: '怪物前摇',
      EQUIPMENT_PICKED_UP: '拾取装备',
      EVENT: '事件',
      HEAL_POINT_SKIPPED: '回复点跳过',
      HEAL_POINT_USED: '回复点使用',
      PAPER_MONEY_DROPPED: '纸钱掉落',
      PAPER_MONEY_PICKED_UP: '拾取纸钱',
      PLAYER_ATTACKED: '角色攻击',
      PLAYER_ATTACK_FAILED: '角色攻击失败',
      PLAYER_BODY_COLLISION: '身体碰撞',
      PLAYER_COMBAT_ENTERED: '进入战斗',
      PLAYER_COMBAT_EXITED: '脱离战斗',
      PLAYER_DAMAGED: '角色受伤',
      PLAYER_DAMAGE_IMMUNED: '伤害被无敌抵消',
      PLAYER_DEFENDED: '角色防御',
      PLAYER_DODGED: '角色闪避',
      PLAYER_HEALED: '角色回复',
      PLAYER_INVINCIBLE_TOGGLED: '无敌状态切换',
      PLAYER_KNOCKBACK_STARTED: '角色被击退',
      PLAYER_MOVE_ENDED: '移动结束',
      PLAYER_MOVE_IGNORED: '移动被忽略',
      PLAYER_MOVE_REFRESHED: '移动刷新',
      PLAYER_MOVE_STARTED: '移动开始',
      PLAYER_SKILL_CAST: '释放技能',
      PLAYER_SKILL_DAMAGED: '技能命中',
      PLAYER_SKILL_FAILED: '技能失败',
      PLAYER_SKILL_RESOLVED: '技能结算',
      PROJECTILE_RESPONSE_WINDOW_ENTERED: '投射物进入响应距离',
      PROJECTILE_SPAWNED: '投射物生成',
      REACTION_IGNORED: '反应被忽略',
      RETREAT_BLOCKED: '返回受阻',
      RETURN_POINT_DISCOVERED: '发现返回点',
      RETURN_POINT_DISTANCE_CHANGED: '返回点距离变化',
      RUN_CODE_VERSION: '运行版本',
      RUN_SPEED_CHANGED: '探索速度切换',
      STATE_BAG_FULL: '背包已满',
      STATE_COMBAT_THREAT: '战斗威胁',
      STATE_HP_LOW: '血量过低',
      STATE_NEW_ROOM: '进入新房间',
      SUPPORT_SKILL_TRIGGERED: '辅助技能触发',
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
      codeVersion: '代码版本',
      continued: '继续冲锋',
      cooldownMs: '冷却',
      cost: '消耗',
      damage: '伤害',
      damageType: '伤害类型',
      defended: '防御减伤',
      direction: '方向',
      distance: '距离',
      durationMs: '持续时间',
      entityId: '实体',
      eventType: '事件',
      gold: '纸钱',
      healAmount: '回复量',
      hpAfter: '回复后血量',
      hpBefore: '回复前血量',
      hp: '血量',
      hitCount: '连击总数',
      hitIndex: '连击序号',
      hitRange: '命中范围',
      identified: '已鉴定',
      itemId: '物品',
      itemLevel: '物品等级',
      lift: '击飞高度',
      manualDesignRequired: '需手动设计',
      maxHp: '血量上限',
      method: '方式',
      mp: '灵力',
      mpAfter: '回复后灵力',
      mpBefore: '回复前灵力',
      mpCost: '灵力消耗',
      mpGain: '灵力回复',
      push: '推动',
      damageApplied: '造成伤害',
      projectileId: '投射物',
      projectileType: '投射物类型',
      quality: '品质',
      qualityRank: '品质等级',
      range: '范围',
      radius: '半径',
      reason: '原因',
      remainingMs: '剩余时间',
      responseDelayMs: '响应延迟',
      responseDistance: '响应距离',
      responseElapsedMs: '实际等待',
      skillId: '技能',
      skillName: '技能名',
      slot: '部位',
      sourceId: '来源',
      sourceType: '来源类型',
      speedMultiplier: '速度倍率',
      stopAtAttackRange: '到攻击距离停止',
      targetId: '目标',
      targetHp: '目标血量',
      targetMaxHp: '目标血量上限',
      targetType: '目标类型',
      threatType: '威胁类型',
      type: '类型',
      x: 'X',
      y: 'Y'
    };

    return labels[key] || key;
  }

  static formatValue(key, value) {
    if (key === 'action') {
      return ReplayFormatter.getActionLabel(value);
    }
    if (key === 'attackType') {
      return ReplayFormatter.getAttackTypeLabel(value);
    }
    if (key === 'damageType') {
      return ReplayFormatter.getDamageTypeLabel(value);
    }
    if (key === 'direction') {
      return ReplayFormatter.getDirectionLabel(value);
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
    if (key === 'quality') {
      return ReplayFormatter.getQualityLabel(value);
    }
    if (key === 'skillId') {
      return ReplayFormatter.getSkillLabel(value);
    }
    if (key === 'slot') {
      return ReplayFormatter.getSlotLabel(value);
    }
    if (key === 'sourceType' || key === 'targetType' || key === 'type') {
      return ReplayFormatter.getEntityTypeLabel(value);
    }
    return value;
  }

  static getAttackTypeLabel(type) {
    const labels = {
      ranged: '远程',
      melee: '近战',
      charge: '冲锋',
      contact: '接触',
      contact_aoe: '接触 AOE',
      boss_charge: 'Boss 冲锋',
      boss_normal: 'Boss 普攻',
      boss_triple: 'Boss 三连击',
      skill_projectile: '技能投射'
    };

    return labels[type] || type;
  }

  static getDamageTypeLabel(type) {
    const labels = {
      projectile: '投射物',
      melee: '近战',
      charge: '冲锋',
      contact: '接触',
      contact_bump: '身体碰撞',
      boss_charge: 'Boss 冲锋',
      boss_normal: 'Boss 普攻',
      boss_triple: 'Boss 三连击',
      skill_projectile: '技能投射',
      dot: '持续伤害'
    };

    return labels[type] || type;
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
      SKILL: '释放技能',
      USE: '使用',
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

  static getDirectionLabel(direction) {
    const labels = {
      left: '左',
      right: '右',
      up: '上',
      down: '下',
      left_up: '左上',
      left_down: '左下',
      right_up: '右上',
      right_down: '右下',
      same: '同位置'
    };

    return labels[direction] || direction;
  }

  static getQualityLabel(quality) {
    const labels = {
      normal: '普通',
      magic: '魔法',
      rare: '稀有',
      epic: '史诗',
      legendary: '传奇'
    };

    return labels[quality] || quality;
  }

  static getSkillLabel(skillId) {
    const skills = globalThis.SkillData || {};
    if (skills[skillId] && skills[skillId].name) {
      return `${skills[skillId].name} (${skillId})`;
    }
    return skillId;
  }

  static getSlotLabel(slot) {
    const labels = {
      weapon: '武器',
      armor: '护甲',
      helmet: '头盔',
      boots: '鞋子',
      ring_left: '戒指',
      ring_right: '戒指',
      amulet: '护符'
    };

    return labels[slot] || slot;
  }

  static getReasonLabel(reason) {
    const labels = {
      already_jumping: '正在跳跃',
      attack_range_reached: '到达攻击距离',
      completed: '完成',
      dash: '冲刺',
      damage_iframe: '受击无敌',
      jump: '跳跃',
      knockback: '被击退',
      no_active_enemy: '没有活动敌人',
      not_enough_gold: '纸钱不足',
      out_of_range: '超出范围',
      response_disabled: '配置为不响应',
      visible_enemy: '看见敌人',
      wall_recover: '撞墙恢复'
    };

    return labels[reason] || reason;
  }
}

window.ReplayFormatter = ReplayFormatter;
