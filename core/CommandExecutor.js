class CommandExecutor {
  constructor(scene) {
    this.scene = scene;
    this.canonicalActions = new Set([
      'MOVE',
      'JUMP',
      'DOUBLE_JUMP',
      'DASH',
      'ATTACK',
      'SKILL',
      'DEFEND',
      'OPEN',
      'USE',
      'PICKUP',
      'DISCARD',
      'RETREAT',
      'WAIT'
    ]);
  }

  execute(command, snapshot) {
    command = this.normalizeCommand(command);
    if (!command || !this.canonicalActions.has(command.action)) {
      console.warn('[CommandExecutor] Unknown command ignored:', command);
      this.scene.addLog(`Command ignored: ${command ? command.action : 'empty'}`);
      return;
    }

    console.log('[CommandExecutor] Executing:', command, 'for event:', snapshot.event.type);
    this.scene.recordRunEvent('COMMAND_EXECUTED', {
      action: command.action,
      eventType: snapshot.event.type,
      targetId: command.targetId || null,
      itemId: command.itemId || null,
      direction: command.direction || null,
      method: command.method || null,
      durationMs: command.durationMs || null,
      skillId: command.skillId || null,
      stopAtAttackRange: Boolean(command.stopAtAttackRange),
      agentSource: command.agentSource || null
    });
    this.scene.addLog(`Execute: ${command.action}`);

    switch (command.action) {
      case 'MOVE':
        this.move(command, snapshot);
        break;
      case 'JUMP':
        this.jump();
        break;
      case 'DOUBLE_JUMP':
        this.doubleJump();
        break;
      case 'DASH':
        this.dash(command.direction);
        break;
      case 'ATTACK':
        this.attack(command.targetId, command.method || 'normal');
        break;
      case 'SKILL':
        this.skill(command.skillId, command.targetId);
        break;
      case 'DEFEND':
        this.defend();
        break;
      case 'OPEN':
        this.open(command.targetId);
        break;
      case 'USE':
        this.use(command.targetId);
        break;
      case 'PICKUP':
        this.pickup(command.targetId);
        break;
      case 'DISCARD':
        this.discard(command.itemId);
        break;
      case 'RETREAT':
        this.retreat();
        break;
      case 'WAIT':
        this.wait();
        break;
      default:
        break;
    }
  }

  normalizeCommand(command) {
    if (!command) {
      return command;
    }

    const normalized = { ...command };
    if (normalized.action === 'USE_SKILL') {
      normalized.action = 'SKILL';
    }
    if (normalized.action === 'DROP') {
      normalized.action = 'DISCARD';
    }
    return normalized;
  }

  interruptDefend(action) {
    if (!this.scene.player.isDefending) {
      return;
    }

    this.scene.player.isDefending = false;
    this.scene.player.defendingUntil = -Infinity;
    this.scene.addLog(`DEFEND interrupted by ${action}`);
  }

  move(command, snapshot) {
    console.log('[CommandExecutor] MOVE:', command.direction);
    if (command.stopAtAttackRange && command.targetId && this.isTargetInPlayerAttackRange(command.targetId)) {
      this.scene.recordRunEvent('PLAYER_MOVE_IGNORED', {
        action: 'MOVE',
        reason: 'already_in_attack_range',
        targetId: command.targetId
      });
      this.attack(command.targetId, 'normal');
      return;
    }

    this.scene.movePlayer(command.direction, {
      durationMs: command.durationMs,
      interruptOnVisibleEnemy: snapshot && snapshot.event && snapshot.event.type === 'STATE_NEW_ROOM',
      sourceEventType: snapshot && snapshot.event ? snapshot.event.type : null,
      targetId: command.targetId || null,
      stopAtAttackRange: Boolean(command.stopAtAttackRange),
      threatType: snapshot && snapshot.event && snapshot.event.details
        ? snapshot.event.details.threatType
        : null
    });
  }

  attack(targetId, method = 'normal') {
    console.log('[CommandExecutor] ATTACK:', targetId, method);
    if (method !== 'normal' && method !== 'skill') {
      this.scene.addLog(`ATTACK ignored: bad method ${method}`);
      return;
    }

    if (method === 'skill') {
      this.skill(null, targetId);
      return;
    }

    const target = this.getTargetById(targetId);
    if (!target) {
      console.warn('[CommandExecutor] ATTACK target not found:', targetId);
      return;
    }

    if (target.kind !== 'enemy') {
      console.warn('[CommandExecutor] ATTACK target is not an enemy:', targetId);
      this.scene.addLog(`ATTACK failed: ${targetId} is not an enemy`);
      return;
    }

    const now = this.scene.time.now;
    this.scene.player.currentTargetId = target.id;
    this.scene.player.facing = target.sprite.x < this.scene.player.sprite.x ? -1 : 1;
    const cooldownRemaining = this.scene.player.attackCooldownMs - (now - this.scene.player.lastAttackAt);
    if (cooldownRemaining > 0) {
      this.scene.recordRunEvent('PLAYER_ATTACK_FAILED', {
        targetId,
        reason: 'cooldown',
        remainingMs: Math.ceil(cooldownRemaining)
      });
      this.scene.addLog(`ATTACK failed: cooldown ${Math.ceil(cooldownRemaining)}ms`);
      this.showCombatText('冷却', this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#ffd166');
      return;
    }

    this.separatePlayerBeforeAttack(target);
    const distance = this.getAttackDistanceToTarget(target);
    this.scene.player.facing = target.sprite.x < this.scene.player.sprite.x ? -1 : 1;
    this.scene.player.lastAttackAt = now;
    this.interruptDefend('ATTACK');
    this.startAttackAction(method);

    if (distance > this.scene.player.attackRange) {
      this.showPlayerAttackSwing(target, false, distance);
      this.scene.recordRunEvent('PLAYER_ATTACK_FAILED', {
        targetId,
        reason: 'out_of_range',
        distance: Math.ceil(distance),
        range: this.scene.player.attackRange
      });
      this.scene.addLog(`ATTACK failed: ${targetId} out of range`);
      this.showCombatText('太远', target.sprite.x, target.sprite.y - 44, '#ffd166');
      return;
    }

    this.showPlayerAttackSwing(target, true, distance);
    const damage = this.getPlayerNormalAttackDamage(target);
    target.hp = Math.max(0, (target.hp || 0) - damage);
    this.scene.recordRunEvent('PLAYER_ATTACKED', {
      targetId,
      method,
      damage,
      distance: Math.ceil(distance),
      range: this.scene.player.attackRange,
      targetHp: target.hp,
      targetMaxHp: target.maxHp
    });
    this.showCombatText(`-${damage}`, target.sprite.x, target.sprite.y - 34, '#99ffd8');
    this.scene.addLog(`ATTACK hit: ${targetId} -${damage} HP (${target.hp}/${target.maxHp})`);
    this.scene.showStatus(`ATTACK hit: ${target.hp}/${target.maxHp}`);
    this.applyPlayerLeech(damage, 'normal_attack');
    this.recordChargeMarkHit(target, 'normal_attack');

    if (target.hp > 0) {
      if (this.scene.combatSystem) {
        this.scene.combatSystem.applyHitReaction(target, this.scene.player);
      }
      return;
    }

    this.killEnemy(target);
  }

  getPlayerNormalAttackDamage(target = null) {
    let multiplier = 1;
    if (this.hasSupportSkill('burning_resonance') && this.isTakingDotDamage()) {
      const skill = this.getSupportSkillById('burning_resonance');
      multiplier += skill.normalAttackDamagePercentWhileTakingDot || 0;
    }

    const state = this.scene.player.supportSkillState || {};
    if (this.hasSupportSkill('aftershock') && state.aftershockReady) {
      const skill = this.getSupportSkillById('aftershock');
      multiplier += skill.nextAttackDamagePercent || 0;
      state.aftershockReady = false;
      this.scene.recordRunEvent('SUPPORT_SKILL_TRIGGERED', {
        skillId: 'aftershock',
        targetId: target ? target.id : null,
        damageMultiplier: skill.nextAttackDamagePercent || 0
      });
    }

    const damageMin = Number(this.scene.player.attackDamageMin || this.scene.player.attackDamage || 1);
    const damageMax = Number(this.scene.player.attackDamageMax || this.scene.player.attackDamage || damageMin);
    const rolledDamage = Phaser.Math.Between(
      Math.max(1, Math.round(Math.min(damageMin, damageMax))),
      Math.max(1, Math.round(Math.max(damageMin, damageMax)))
    );
    let damage = Math.max(1, Math.round(rolledDamage * multiplier));
    const passiveCritChance = this.scene.player.critChancePercent || 0;
    if (passiveCritChance > 0) {
      const didPassiveCrit = Phaser.Math.FloatBetween(0, 1) < passiveCritChance;
      if (didPassiveCrit) {
        damage = Math.max(1, Math.round(damage * (1.5 + (this.scene.player.critDamagePercent || 0))));
      }
    }
    if (this.hasSupportSkill('charge_mark') && state.nextAttackCritChanceBonus > 0) {
      const didCrit = Phaser.Math.FloatBetween(0, 1) < state.nextAttackCritChanceBonus;
      const critMultiplier = window.SkillsData && SkillsData.critMultiplier ? SkillsData.critMultiplier : 1.5;
      state.nextAttackCritChanceBonus = 0;
      this.scene.recordRunEvent('SUPPORT_SKILL_TRIGGERED', {
        skillId: 'charge_mark',
        targetId: target ? target.id : null,
        critChanceBonus: 0.4,
        didCrit,
        critMultiplier
      });
      if (didCrit) {
        damage = Math.max(1, Math.round(damage * critMultiplier));
      }
    }

    return damage;
  }

  applyPlayerLeech(damage, reason) {
    const flatLeech = this.scene.player.hpLeechPerHit || 0;
    const skillLeech = reason === 'normal_attack' && this.hasSupportSkill('flesh_siphon')
      ? damage * ((this.getSupportSkillById('flesh_siphon').normalAttackLeechPercent || 0))
      : 0;
    const leech = flatLeech + skillLeech;
    if (leech <= 0 || this.scene.player.hp >= this.scene.player.maxHp) {
      return;
    }

    const healAmount = Math.max(0, Math.round(leech));
    if (healAmount <= 0) {
      return;
    }

    const beforeHp = this.scene.player.hp;
    this.scene.player.hp = Math.min(this.scene.player.maxHp, this.scene.player.hp + healAmount);
    this.scene.recordRunEvent('PLAYER_HEALED', {
      reason,
      healAmount,
      hpBefore: Math.ceil(beforeHp),
      hpAfter: Math.ceil(this.scene.player.hp)
    });
  }

  recordChargeMarkHit(target, damageType) {
    if (!this.hasSupportSkill('charge_mark') || !target) {
      return;
    }

    const skill = this.getSupportSkillById('charge_mark');
    const state = this.scene.player.supportSkillState;
    if (state.chargeMarkTargetId !== target.id) {
      state.chargeMarkTargetId = target.id;
      state.chargeMarkHits = 0;
    }

    state.chargeMarkHits += 1;
    if (state.chargeMarkHits < (skill.requiredHits || 3)) {
      return;
    }

    state.chargeMarkHits = 0;
    state.nextAttackCritChanceBonus = skill.nextHitCritChanceBonus || 0.4;
    this.scene.recordRunEvent('SUPPORT_SKILL_TRIGGERED', {
      skillId: 'charge_mark',
      targetId: target.id,
      damageType,
      nextHitCritChanceBonus: state.nextAttackCritChanceBonus
    });
  }

  isBurningAuraActive() {
    return (this.scene.player.activeSkillEffects || []).some((effect) => effect.skillId === 'burning_aura');
  }

  isTakingDotDamage() {
    const state = this.scene.player.supportSkillState || {};
    return this.scene.time.now <= (state.takingDotDamageUntil || -Infinity);
  }

  hasSupportSkill(skillId) {
    return (this.scene.player.supportSkillIds || []).includes(skillId);
  }

  getSupportSkillById(skillId) {
    return window.SkillsData && SkillsData.supportSkills ? SkillsData.supportSkills[skillId] || {} : {};
  }

  skill(skillId = null, targetId = null) {
    const activeSkillId = this.scene.player.activeSkillId;
    const skill = this.getSkillById(activeSkillId);
    if (!skill) {
      this.scene.recordRunEvent('PLAYER_SKILL_FAILED', {
        skillId: activeSkillId,
        targetId,
        reason: 'unknown_skill'
      });
      this.scene.addLog(`SKILL failed: unknown ${activeSkillId || 'empty'}`);
      return;
    }

    if (!(this.scene.player.skills || []).includes(skill.id)) {
      this.scene.recordRunEvent('PLAYER_SKILL_FAILED', {
        skillId: skill.id,
        targetId,
        reason: 'not_learned'
      });
      this.scene.addLog(`SKILL failed: ${skill.id} not learned`);
      return;
    }

    const now = this.scene.time.now;
    const readyAt = this.scene.player.skillCooldowns[skill.id] || -Infinity;
    if (now < readyAt) {
      const remainingMs = Math.ceil(readyAt - now);
      this.scene.recordRunEvent('PLAYER_SKILL_FAILED', {
        skillId: skill.id,
        targetId,
        reason: 'cooldown',
        remainingMs
      });
      this.showCombatText('\u6280\u80fd\u51b7\u5374', this.scene.player.sprite.x, this.scene.player.sprite.y - 54, '#ffd166');
      return;
    }

    const mpCost = skill.mpCost || 0;
    if (this.scene.player.mp < mpCost) {
      this.scene.recordRunEvent('PLAYER_SKILL_FAILED', {
        skillId: skill.id,
        targetId,
        reason: 'not_enough_mp',
        mp: Math.ceil(this.scene.player.mp),
        mpCost
      });
      this.showCombatText('\u7075\u529b\u4e0d\u8db3', this.scene.player.sprite.x, this.scene.player.sprite.y - 54, '#ffd166');
      return;
    }

    this.interruptDefend('SKILL');
    this.scene.player.mp = Math.max(0, this.scene.player.mp - mpCost);
    this.scene.player.activeSkillId = skill.id;
    this.scene.player.skillCooldowns[skill.id] = now + this.getSkillCooldownMs(skill);
    this.startAttackAction('skill');

    const result = this.scene.combatSystem
      ? this.scene.combatSystem.castPlayerSkill(skill, targetId)
      : { hitCount: 0 };
    this.scene.recordRunEvent('PLAYER_SKILL_CAST', {
      skillId: skill.id,
      skillName: skill.name,
      targetId: targetId || null,
      mpCost,
      mp: Math.ceil(this.scene.player.mp),
      cooldownMs: this.getSkillCooldownMs(skill),
      hitCount: result.hitCount || 0
    });
    this.scene.updateHud();
  }

  killEnemy(target) {
    const lootX = target.sprite.x;
    const lootY = target.sprite.y;
    target.active = false;
    if (this.scene.combatSystem) {
      this.scene.combatSystem.destroyEntityCombat(target);
    }
    target.sprite.destroy();
    if (target.label) {
      target.label.destroy();
    }
    if (target.visuals) {
      target.visuals.forEach((visual) => visual.destroy());
      target.visuals = [];
    }
    this.scene.eventSystem.markEntityResolved(target.id);
    if (target.type !== 'boss_floor1') {
      this.scene.spawnLoot(lootX, lootY);
      if (this.scene.spawnPaperMoney) {
        this.scene.spawnPaperMoney(lootX, lootY);
      }
    }
    this.scene.recordRunEvent('ENEMY_DIED', {
      targetId: target.id,
      type: target.type
    });
    if (this.scene.movementSystem && !this.scene.movementSystem.hasActiveEnemy()) {
      this.scene.movementSystem.exitPlayerCombat();
    }
    if (target.type === 'boss_floor1') {
      this.scene.unlockBossReturnPoint();
    }
    this.applySupportSkillOnKill(target);
    this.scene.showStatus(target.type === 'boss_floor1' ? 'BOSS defeated: rewards appeared' : 'ENEMY defeated: loot dropped');
    this.scene.addLog(`ENEMY defeated: ${target.id}`);
  }

  applySupportSkillOnKill(target) {
    if (!this.hasSupportSkill('spirit_siphon')) {
      return;
    }

    const skill = this.getSupportSkillById('spirit_siphon');
    const mpGain = skill.mpOnKill || 15;
    const beforeMp = this.scene.player.mp;
    this.scene.player.mp = Math.min(this.scene.player.maxMp, this.scene.player.mp + mpGain);
    this.scene.recordRunEvent('SUPPORT_SKILL_TRIGGERED', {
      skillId: 'spirit_siphon',
      targetId: target.id,
      mpGain,
      mpBefore: Math.ceil(beforeMp),
      mpAfter: Math.ceil(this.scene.player.mp)
    });
  }

  jump() {
    console.log('[CommandExecutor] JUMP');
    const didUseSkill = this.scene.jumpPlayer();
    if (!didUseSkill) {
      this.scene.recordRunEvent('REACTION_IGNORED', {
        action: 'JUMP',
        reason: 'already_jumping'
      });
      this.scene.addLog('JUMP ignored');
    }
  }

  doubleJump() {
    console.log('[CommandExecutor] DOUBLE_JUMP');
    if (!this.scene.doubleJumpPlayer()) {
      this.scene.recordRunEvent('REACTION_IGNORED', {
        action: 'DOUBLE_JUMP',
        reason: 'not_available'
      });
    }
  }

  dash(direction = 'right') {
    console.log('[CommandExecutor] DASH:', direction);
    if (!this.scene.dashPlayer(direction)) {
      this.scene.recordRunEvent('REACTION_IGNORED', {
        action: 'DASH',
        reason: 'not_available',
        direction
      });
    }
  }

  defend() {
    console.log('[CommandExecutor] DEFEND');
    this.scene.player.isDefending = true;
    this.scene.player.defendingUntil = this.scene.time.now + 3000;
    this.scene.addLog('DEFEND started');
    this.scene.recordRunEvent('PLAYER_DEFENDED', {
      durationMs: 3000,
      damageReduction: 0.5
    });
  }

  open(targetId) {
    console.log('[CommandExecutor] OPEN:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
    if (!target) {
      console.warn('[CommandExecutor] OPEN target not found:', targetId);
      return;
    }

    this.interruptDefend('OPEN');

    if (target.kind === 'chest') {
      this.scene.player.gold += target.gold || 0;
      if (this.scene.spawnLoot) {
        const lootX = target.sprite.x - 48;
        const lootY = target.sprite.y + (target.sprite.height || 38) / 2 + 18;
        this.scene.spawnLoot(lootX, lootY);
      }
      if (target.buff) {
        this.scene.player.buffs.push({
          type: target.buff,
          remainingTime: 30
        });
      }
      this.scene.updateHud();
    }

    this.scene.eventSystem.markEntityResolved(targetId);
    this.scene.showStatus(`OPEN resolved: ${targetId}`);
    this.scene.addLog(`OPEN resolved: +${target.gold || 0} paper money`);
  }

  use(targetId) {
    console.log('[CommandExecutor] USE:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
    if (!target) {
      console.warn('[CommandExecutor] USE target not found:', targetId);
      return;
    }

    this.interruptDefend('USE');

    if (target.kind !== 'heal_point') {
      this.scene.addLog(`USE ignored: ${targetId} is not usable`);
      this.scene.eventSystem.markEntityResolved(targetId);
      return;
    }

    const cost = target.cost || 0;
    const healAmount = Math.ceil(this.scene.player.maxHp * (target.healRatio || 0.5));
    const beforeHp = Math.ceil(this.scene.player.hp);
    const canHeal = this.scene.player.hp < this.scene.player.maxHp;
    const canPay = this.scene.player.gold >= cost;

    if (canPay && canHeal) {
      this.scene.player.gold -= cost;
      this.scene.player.hp = Math.min(this.scene.player.maxHp, this.scene.player.hp + healAmount);
      this.scene.recordRunEvent('HEAL_POINT_USED', {
        entityId: target.id,
        cost,
        healAmount,
        hpBefore: beforeHp,
        hpAfter: Math.ceil(this.scene.player.hp),
        gold: this.scene.player.gold
      });
      this.showCombatText(`+${Math.ceil(this.scene.player.hp) - beforeHp}`, target.sprite.x, target.sprite.y - 44, '#99ffd8');
      this.scene.showStatus(`HEAL resolved: ${beforeHp} -> ${Math.ceil(this.scene.player.hp)}`);
      this.scene.addLog(`HEAL resolved: -${cost} paper money`);
    } else {
      this.scene.recordRunEvent('HEAL_POINT_SKIPPED', {
        entityId: target.id,
        reason: canPay ? 'hp_full' : 'not_enough_gold',
        cost,
        gold: this.scene.player.gold,
        hp: beforeHp,
        maxHp: this.scene.player.maxHp
      });
      this.scene.showStatus(canPay ? 'HEAL skipped: HP full' : 'HEAL skipped: not enough paper money');
      this.scene.addLog(canPay ? 'HEAL skipped: HP full' : 'HEAL skipped: not enough paper money');
    }

    this.scene.updateHud();
    this.scene.eventSystem.markEntityResolved(targetId);
  }

  pickup(targetId) {
    console.log('[CommandExecutor] PICKUP:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
    if (!target) {
      console.warn('[CommandExecutor] PICKUP target not found:', targetId);
      return;
    }

    if (target.kind === 'paper_money') {
      this.pickupPaperMoney(target);
      return;
    }

    if (this.scene.inventorySystem.isFull()) {
      this.scene.addLog('PICKUP failed: bag full');
      return;
    }

    this.interruptDefend('PICKUP');
    this.destroyPickedEntity(target);

    const item = target.item
      ? { ...target.item, affixes: (target.item.affixes || []).map((affix) => ({ ...affix })) }
      : { id: target.itemId, kind: 'equipment', quality: target.quality };
    this.scene.inventorySystem.add(item);
    this.scene.updateHud();
    this.scene.eventSystem.markEntityResolved(targetId);
    this.scene.recordRunEvent('EQUIPMENT_PICKED_UP', {
      itemId: item.id,
      quality: item.quality,
      itemLevel: item.itemLevel || 1,
      slot: item.slot || null,
      qualityRank: item.qualityRank || null,
      identified: Boolean(item.identified),
      manualDesignRequired: Boolean(item.manualDesignRequired)
    });
    this.scene.showStatus(`PICKUP resolved: ${target.quality} item added`);
    this.scene.addLog(`PICKUP resolved: ${target.quality} item added`);
  }

  pickupPaperMoney(target) {
    this.interruptDefend('PICKUP');
    const amount = Math.max(0, Math.round(target.amount || 0));
    this.destroyPickedEntity(target);

    this.scene.player.gold += amount;
    this.scene.updateHud();
    this.scene.eventSystem.markEntityResolved(target.id);
    this.scene.recordRunEvent('PAPER_MONEY_PICKED_UP', {
      entityId: target.id,
      amount,
      gold: this.scene.player.gold
    });
    this.showCombatText(`+${amount}`, this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#ffd98a');
    this.scene.showStatus(`PICKUP resolved: +${amount} paper money`);
    this.scene.addLog(`PICKUP resolved: +${amount} paper money`);
  }

  discard(itemId) {
    console.log('[CommandExecutor] DISCARD:', itemId);
    const removed = this.scene.inventorySystem.remove(itemId);
    if (!removed) {
      console.warn('[CommandExecutor] DISCARD item not found:', itemId);
      this.scene.addLog(`DISCARD failed: ${itemId} not found`);
      return;
    }

    this.interruptDefend('DISCARD');
    this.scene.eventSystem.clearStateEvent('STATE_BAG_FULL');
    this.scene.updateHud();
    this.scene.showStatus(`DISCARD resolved: ${itemId}`);
    this.scene.addLog(`DISCARD resolved: ${itemId}`);
  }

  retreat() {
    console.log('[CommandExecutor] RETREAT');
    if (this.scene.hasActiveBoss && this.scene.hasActiveBoss()) {
      this.scene.recordRunEvent('RETREAT_BLOCKED', {
        reason: 'boss_alive'
      });
      this.scene.showStatus('RETREAT blocked: defeat the Boss first');
      this.scene.addLog('RETREAT blocked: Boss is still alive');
      return;
    }
    this.interruptDefend('RETREAT');
    this.scene.startRetreat();
  }

  wait() {
    console.log('[CommandExecutor] WAIT');
  }

  showCombatText(text, x, y, color) {
    if (this.scene.combatSystem) {
      this.scene.combatSystem.flashText(text, x, y, color);
    }
  }

  showPlayerAttackSwing(target, didHit, distance) {
    if (this.scene.combatSystem) {
      this.scene.combatSystem.showPlayerAttackSwing(target, didHit, distance);
    }
  }

  getAttackDistanceToTarget(target) {
    if (this.scene.combatSystem) {
      return this.scene.combatSystem.getPlayerEntityBoundsDistance(target);
    }

    return Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      target.sprite.x,
      target.sprite.y
    );
  }

  getTargetById(targetId) {
    return this.scene.entities.find((entity) => entity.id === targetId && entity.active) || null;
  }

  getSkillById(skillId) {
    if (!skillId || !window.SkillsData || !SkillsData.skills) {
      return null;
    }
    return SkillsData.skills[skillId] || null;
  }

  getSkillCooldownMs(skill) {
    const reduction = this.scene.player.skillStats
      ? this.scene.player.skillStats.cooldownReductionPercent || 0
      : 0;
    const floorMs = window.SkillsData && SkillsData.skillCooldownFloorMs !== undefined
      ? SkillsData.skillCooldownFloorMs
      : 250;
    return Math.max(floorMs, Math.round((skill.cooldownMs || 0) * (1 - reduction)));
  }

  separatePlayerBeforeAttack(target) {
    if (!this.scene.combatSystem || typeof this.scene.combatSystem.getPlayerEnemyOverlap !== 'function') {
      return;
    }

    const overlap = this.scene.combatSystem.getPlayerEnemyOverlap(target);
    if (!overlap || typeof this.scene.combatSystem.separatePlayerFromEntity !== 'function') {
      return;
    }

    this.scene.combatSystem.separatePlayerFromEntity(target);
  }

  destroyPickedEntity(target) {
    target.active = false;
    this.destroyGameObject(target.sprite);
    this.destroyGameObject(target.label);
    if (target.visuals) {
      target.visuals.forEach((visual) => this.destroyGameObject(visual));
      target.visuals = [];
    }
    this.scene.entities = this.scene.entities.filter((entity) => entity !== target);
    if (this.scene.eventSystem) {
      this.scene.eventSystem.visibleEntityIds.delete(target.id);
    }
  }

  destroyGameObject(object) {
    if (!object) {
      return;
    }

    if (this.scene.tweens) {
      this.scene.tweens.killTweensOf(object);
    }
    if (typeof object.setVisible === 'function') {
      object.setVisible(false);
    }
    if (typeof object.destroy === 'function' && !object.destroyed) {
      object.destroy();
    }
  }

  isTargetInPlayerAttackRange(targetId) {
    const target = this.getTargetById(targetId);
    if (!target || target.kind !== 'enemy') {
      return false;
    }

    return this.getAttackDistanceToTarget(target) <= this.scene.player.attackRange;
  }

  startAttackAction(method) {
    const durationMs = 260;
    const until = this.scene.time.now + durationMs;
    this.scene.player.isAttacking = true;
    this.scene.player.currentAttackAction = method === 'skill' ? 'SKILL_ATTACK' : 'ATTACK';
    this.scene.player.attackActionUntil = until;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.scene.player.attackActionUntil <= until) {
        this.scene.player.isAttacking = false;
        this.scene.player.currentAttackAction = null;
        this.scene.player.attackActionUntil = -Infinity;
      }
    });
  }
}

window.CommandExecutor = CommandExecutor;
