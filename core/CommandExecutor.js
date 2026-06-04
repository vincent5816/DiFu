class CommandExecutor {
  constructor(scene) {
    this.scene = scene;
    this.canonicalActions = new Set([
      'MOVE',
      'JUMP',
      'DOUBLE_JUMP',
      'DASH',
      'ATTACK',
      'DEFEND',
      'OPEN',
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
      case 'DEFEND':
        this.defend();
        break;
      case 'OPEN':
        this.open(command.targetId);
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
      normalized.action = 'JUMP';
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
    const damage = method === 'skill'
      ? this.scene.player.attackDamage
      : this.scene.player.attackDamage;
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

    if (target.hp > 0) {
      if (this.scene.combatSystem) {
        this.scene.combatSystem.applyHitReaction(target, this.scene.player);
      }
      return;
    }

    this.killEnemy(target);
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
    this.scene.spawnLoot(lootX, lootY);
    this.scene.recordRunEvent('ENEMY_DIED', {
      targetId: target.id,
      type: target.type
    });
    if (target.type === 'boss_floor1') {
      this.scene.unlockBossReturnPoint();
    }
    this.scene.showStatus('ENEMY defeated: loot dropped');
    this.scene.addLog(`ENEMY defeated: ${target.id}`);
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

  pickup(targetId) {
    console.log('[CommandExecutor] PICKUP:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
    if (!target) {
      console.warn('[CommandExecutor] PICKUP target not found:', targetId);
      return;
    }

    if (this.scene.inventorySystem.isFull()) {
      this.scene.addLog('PICKUP failed: bag full');
      return;
    }

    this.interruptDefend('PICKUP');
    target.active = false;
    target.sprite.destroy();
    if (target.label) {
      target.label.destroy();
    }

    this.scene.inventorySystem.add({
      id: target.itemId,
      quality: target.quality
    });
    this.scene.updateHud();
    this.scene.eventSystem.markEntityResolved(targetId);
    this.scene.showStatus(`PICKUP resolved: ${target.quality} item added`);
    this.scene.addLog(`PICKUP resolved: ${target.quality} item`);
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
