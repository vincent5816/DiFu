class AgentReplayIndex {
  static create(summary) {
    const analysis = AgentReplayIndex.analyze(summary);
    const lines = [
      '# 给策略伙伴的经历材料',
      '',
      '你是玩家的策略伙伴，不是调试工具。请先把这局经历讲给玩家听，再和玩家商量下一版 onEvent(snapshot) 策略。',
      '',
      '表达要求：不要使用事件名、字段名、毫秒时间、JSON、日志口吻。不要修改游戏源码。像一个冷静、危险、话少的同伴一样说话。你可以说“我被爪子打中了”“我没躲开正面的冲锋”“我那一刀太远了”。',
      '',
      '## 我这局的结局',
      ...AgentReplayIndex.createOutcomeLines(summary, analysis),
      '',
      '## 我看见的敌人',
      ...AgentReplayIndex.createEnemyLines(analysis),
      '',
      '## 它露出来的招',
      ...AgentReplayIndex.createMoveLines(analysis),
      '',
      '## 我做过的应对',
      ...AgentReplayIndex.createResponseLines(analysis),
      '',
      '## 我倒下的原因',
      ...AgentReplayIndex.createFailureLines(summary, analysis),
      '',
      '## 下一轮该一起商量',
      ...AgentReplayIndex.createDiscussionLines(analysis)
    ];

    return lines.join('\n');
  }

  static createDeveloperLog(summary) {
    return JSON.stringify({
      note: '开发者完整局内日志。events 为完整事件流，不做截断；用于排查游戏逻辑、事件顺序和策略执行。',
      result: summary.result,
      floor: summary.floor,
      roomId: summary.roomId,
      hp: summary.hp,
      maxHp: summary.maxHp,
      gold: summary.gold,
      bag: summary.bag,
      lostItems: summary.lostItems || [],
      newCodexEntries: summary.newCodexEntries || [],
      eventCount: (summary.events || []).length,
      events: summary.events || []
    }, null, 2);
  }

  static analyze(summary) {
    const events = summary.events || [];
    const commandEvents = events.filter((event) => event.type === 'COMMAND_EXECUTED');
    const damageEvents = events.filter((event) => event.type === 'PLAYER_DAMAGED');
    const dodgeEvents = events.filter((event) => event.type === 'PLAYER_DODGED');
    const ignoredEvents = events.filter((event) => event.type === 'REACTION_IGNORED');
    const attackFailedEvents = events.filter((event) => event.type === 'PLAYER_ATTACK_FAILED');
    const playerAttackEvents = events.filter((event) => event.type === 'PLAYER_ATTACKED');
    const bossAttackEvents = playerAttackEvents.filter((event) => event.details.targetId === 'boss_001');
    const lastBossAttack = bossAttackEvents[bossAttackEvents.length - 1] || null;
    const lastDamage = damageEvents[damageEvents.length - 1] || null;
    const firstBossSeen = events.find((event) => {
      return event.type === 'VISION_ENTITY_ENTERED' && event.details.entityId === 'boss_001';
    });
    const firstBossCharge = events.find((event) => event.type === 'BOSS_CHARGE_WINDUP');

    return {
      events,
      commandEvents,
      damageEvents,
      dodgeEvents,
      ignoredEvents,
      attackFailedEvents,
      playerAttackEvents,
      bossAttackEvents,
      lastBossAttack,
      lastDamage,
      firstBossSeen,
      firstBossCharge,
      enemies: AgentReplayIndex.getObservedEnemies(events),
      moves: AgentReplayIndex.getObservedBossMoves(events),
      damageByType: AgentReplayIndex.countByDetail(damageEvents, 'damageType'),
      dodgeByType: AgentReplayIndex.countByDetail(dodgeEvents, 'damageType'),
      ignoredByAction: AgentReplayIndex.countByDetail(ignoredEvents, 'action'),
      commandsByAction: AgentReplayIndex.countByDetail(commandEvents, 'action'),
      attackFailuresByReason: AgentReplayIndex.countByDetail(attackFailedEvents, 'reason'),
      lowHpAttack: AgentReplayIndex.hasLowHpAttack(commandEvents),
      chargeStartedBeforeVision: Boolean(firstBossCharge && firstBossSeen && firstBossCharge.time < firstBossSeen.time)
    };
  }

  static createOutcomeLines(summary, analysis) {
    const lines = [];
    const hpText = `${summary.hp}/${summary.maxHp}`;

    if (summary.result === 'death') {
      lines.push(`- 我死在第 ${summary.floor} 层的 ${summary.roomId}。最后血量是 ${hpText}。`);
    } else if (summary.result === 'retreat') {
      lines.push(`- 我从第 ${summary.floor} 层的 ${summary.roomId} 撤了回来。最后血量是 ${hpText}。`);
    } else {
      lines.push(`- 这一局停在第 ${summary.floor} 层的 ${summary.roomId}。最后血量是 ${hpText}。`);
    }

    if (analysis.lastBossAttack) {
      lines.push(`- Boss 没死。我最后一次砍中它时，它还剩${AgentReplayIndex.getHpRatioText(analysis.lastBossAttack)}。`);
    }

    if (summary.bag && summary.bag.used > 0) {
      lines.push(`- 我身上还有 ${summary.bag.used} 件东西。没能安全带回来。`);
    }

    return lines;
  }

  static createEnemyLines(analysis) {
    if (analysis.enemies.length === 0) {
      return ['- 我没有真正看清新的敌人。'];
    }

    return analysis.enemies.map((enemy) => {
      if (enemy === 'boss_floor1') {
        return '- 我遇到了一层 Boss。它不是木桩，会贴近，会冲锋，会把节奏从我手里抢走。';
      }

      return `- 我遇到了 ${AgentReplayIndex.getReadableEnemyName(enemy)}。`;
    });
  }

  static createMoveLines(analysis) {
    const lines = [];

    if (analysis.chargeStartedBeforeVision) {
      lines.push('- 我第一次看见 Boss 时，它已经在冲锋的节奏里了。能反应，但窗口很窄。');
    }
    if (analysis.moves.charge) {
      lines.push('- 它会正面冲过来。撞上就是重伤；躲开以后，它还会继续往墙上撞，不会因为我擦身躲过就停下。');
    }
    if (analysis.moves.normal) {
      lines.push('- 它会近身挥击。前面有一小段准备动作，吃满很疼；架住也只是减伤，不是无伤。');
    }
    if (analysis.moves.triple) {
      lines.push('- 血线压低后，它会打三连。节奏短，容错低，站在原地会被收掉。');
    }
    if (analysis.moves.stun) {
      lines.push('- 它有短暂的硬直窗口。那时候可以考虑贴近、补刀，但距离不够就会空挥。');
    }

    return lines.length > 0 ? lines : ['- 我没能看清它完整出招。'];
  }

  static createResponseLines(analysis) {
    const lines = [];
    const defendedHits = analysis.damageEvents.filter((event) => event.details.defended).length;
    const dashDodges = analysis.dodgeEvents.filter((event) => event.details.reason === 'dash').length;
    const ignoredDash = analysis.ignoredByAction.DASH || 0;
    const jumpCount = analysis.commandsByAction.JUMP || 0;
    const chargeDamage = analysis.damageByType.boss_charge || 0;
    const cooldownFails = analysis.attackFailuresByReason.cooldown || 0;
    const rangeFails = analysis.attackFailuresByReason.out_of_range || 0;

    if (dashDodges > 0) {
      lines.push(`- 我用冲刺躲开过 ${dashDodges} 次伤害。这个办法能救命，但不能乱交。`);
    }
    if (ignoredDash > 0) {
      lines.push(`- 我也有 ${ignoredDash} 次想冲刺，身体没动。冲刺还没恢复。`);
    }
    if (jumpCount > 0 && chargeDamage > 0) {
      lines.push('- 我跳过，但还是被冲锋撞中过。跳起来不等于安全，得让身体真的离开撞击体积。');
    }
    if (defendedHits > 0) {
      lines.push(`- 我防住过 ${defendedHits} 次攻击。伤害被压下来了，但血还在掉。`);
    }
    if (analysis.bossAttackEvents.length > 0) {
      lines.push(`- 我砍中过 Boss ${analysis.bossAttackEvents.length} 次。能打掉血，但不能只靠贪刀。`);
    }
    if (cooldownFails > 0) {
      lines.push(`- 我有 ${cooldownFails} 刀出早了。刀还没回过来。`);
    }
    if (rangeFails > 0) {
      lines.push(`- 我有 ${rangeFails} 刀够不到。反击前需要先确认距离。`);
    }

    return lines.length > 0 ? lines : ['- 我这局几乎没有做出有效应对。'];
  }

  static createFailureLines(summary, analysis) {
    const lines = [];
    const chargeDamage = analysis.damageByType.boss_charge || 0;
    const normalDamage = analysis.damageByType.boss_normal || 0;
    const tripleDamage = analysis.damageByType.boss_triple || 0;
    const contactDamage = analysis.damageByType.contact_bump || 0;

    if (chargeDamage > 0) {
      lines.push('- 正面冲锋打中过我。那一下把血线砸得很低。');
    }
    if (normalDamage > 0) {
      lines.push('- 近身挥击一直在磨我。防御能止血，但不能让我一直站在它脸上。');
    }
    if (contactDamage > 0) {
      lines.push('- 我贴得太近时会被它身体顶开。伤害不高，但位置会乱。');
    }
    if (tripleDamage > 0) {
      lines.push('- 进入二阶段后，我没处理好三连。最后就是被这套收掉的。');
    }
    if (analysis.lowHpAttack) {
      lines.push('- 血线见底后，我还在挥刀。那不是勇，是把最后的容错烧掉。');
    }
    if (summary.hp <= 0 && analysis.lastDamage) {
      lines.push('- 我死前已经没有余量。最后一击不是意外，是前面留下的债。');
    }

    return lines.length > 0 ? lines : ['- 我倒下的原因还不清楚。下一局需要靠画面和这份经历一起复盘。'];
  }

  static createDiscussionLines(analysis) {
    const lines = [
      '- 先决定：冲锋来时，是跳、冲刺，还是先保留冲刺给更危险的窗口。',
      '- 再决定：近身挥击前，是防御到底，还是先拉开一点距离。',
      '- 硬直时不要只写“攻击”。如果距离不够，先接近，再砍。',
      '- 血量很低时，别让默认攻击继续接管。先定义保命行为。'
    ];

    if (analysis.moves.triple) {
      lines.push('- 二阶段三连需要单独写策略。它不能和普通挥击混在一起处理。');
    }

    return lines;
  }

  static getObservedEnemies(events) {
    const enemies = new Set();
    events.forEach((event) => {
      const details = event.details || {};
      const type = details.type || details.sourceType;
      if (type && type !== 'return_gate') {
        enemies.add(type);
      }
    });
    return [...enemies];
  }

  static getObservedBossMoves(events) {
    return {
      charge: events.some((event) => event.type.includes('CHARGE')),
      normal: events.some((event) => event.type.includes('NORMAL')),
      triple: events.some((event) => event.type.includes('TRIPLE')),
      stun: events.some((event) => event.type.includes('STUNNED'))
    };
  }

  static countByDetail(events, key) {
    return events.reduce((counts, event) => {
      const details = event.details || {};
      const value = details[key] || 'unknown';
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  static hasLowHpAttack(commandEvents) {
    return commandEvents.some((event) => {
      const details = event.details || {};
      return details.eventType === 'STATE_HP_LOW' && details.action === 'ATTACK';
    });
  }

  static getReadableEnemyName(enemy) {
    const names = {
      melee_a: '近战怪',
      melee_b: '重击怪',
      ranged_a: '远程怪',
      charger_a: '冲锋怪'
    };
    return names[enemy] || enemy;
  }

  static getHpRatioText(event) {
    const details = event.details || {};
    const hp = details.targetHp;
    const maxHp = details.targetMaxHp;
    if (!maxHp && maxHp !== 0) {
      return '不少血';
    }

    const ratio = hp / maxHp;
    if (ratio <= 0.2) {
      return '一点血';
    }
    if (ratio <= 0.4) {
      return '大约三分之一血';
    }
    if (ratio <= 0.65) {
      return '大约半血';
    }
    return '大半管血';
  }
}

window.AgentReplayIndex = AgentReplayIndex;
