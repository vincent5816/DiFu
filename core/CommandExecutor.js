class CommandExecutor {
  constructor(scene) {
    this.scene = scene;
    this.validActions = new Set([
      'MOVE',
      'ATTACK',
      'USE_SKILL',
      'OPEN',
      'SKIP',
      'PICKUP',
      'DROP',
      'RETREAT',
      'WAIT'
    ]);
  }

  execute(command, snapshot) {
    if (!command || !this.validActions.has(command.action)) {
      console.warn('[CommandExecutor] Unknown command ignored:', command);
      this.scene.addLog(`Command ignored: ${command ? command.action : 'empty'}`);
      return;
    }

    console.log('[CommandExecutor] Executing:', command, 'for event:', snapshot.event.type);
    this.scene.recordRunEvent('COMMAND_EXECUTED', {
      action: command.action,
      eventType: snapshot.event.type,
      targetId: command.targetId || null,
      itemId: command.itemId || null
    });
    this.scene.addLog(`Execute: ${command.action}`);

    switch (command.action) {
      case 'MOVE':
        this.move(command.direction, snapshot);
        break;
      case 'ATTACK':
        this.attack(command.targetId);
        break;
      case 'USE_SKILL':
        this.useSkill(command.targetId);
        break;
      case 'OPEN':
        this.open(command.targetId);
        break;
      case 'SKIP':
        this.skip(command.targetId);
        break;
      case 'PICKUP':
        this.pickup(command.targetId);
        break;
      case 'DROP':
        this.drop(command.itemId);
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

  move(direction, snapshot) {
    console.log('[CommandExecutor] MOVE:', direction);
    const isCombatBackstep = snapshot &&
      snapshot.event.type === 'STATE_COMBAT_THREAT' &&
      snapshot.event.details &&
      snapshot.event.details.threatType === 'ENEMY_WINDUP' &&
      snapshot.event.details.attackType === 'melee' &&
      direction === 'left';

    this.scene.movePlayer(direction, {
      combatBackstep: isCombatBackstep,
      sourceId: isCombatBackstep ? snapshot.event.entityId : null
    });
  }

  attack(targetId) {
    console.log('[CommandExecutor] ATTACK:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
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

    const distance = Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      target.sprite.x,
      target.sprite.y
    );
    this.scene.player.lastAttackAt = now;

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
    target.hp = Math.max(0, (target.hp || 0) - this.scene.player.attackDamage);
    this.scene.recordRunEvent('PLAYER_ATTACKED', {
      targetId,
      damage: this.scene.player.attackDamage,
      targetHp: target.hp,
      targetMaxHp: target.maxHp
    });
    this.showCombatText(`-${this.scene.player.attackDamage}`, target.sprite.x, target.sprite.y - 34, '#99ffd8');
    this.scene.addLog(`ATTACK hit: ${targetId} -${this.scene.player.attackDamage} HP (${target.hp}/${target.maxHp})`);
    this.scene.showStatus(`ATTACK hit: ${target.hp}/${target.maxHp}`);

    if (target.hp > 0) {
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
    this.scene.showStatus('ENEMY defeated: loot dropped');
    this.scene.addLog(`ENEMY defeated: ${target.id}`);
  }

  useSkill(targetId) {
    console.log('[CommandExecutor] USE_SKILL:', targetId);
    const didUseSkill = this.scene.jumpPlayer();
    if (!didUseSkill) {
      this.scene.recordRunEvent('REACTION_IGNORED', {
        action: 'USE_SKILL',
        reason: 'already_jumping',
        targetId: targetId || null
      });
      this.scene.addLog('USE_SKILL ignored: already jumping');
    }
  }

  open(targetId) {
    console.log('[CommandExecutor] OPEN:', targetId);
    const target = this.scene.entities.find((entity) => entity.id === targetId && entity.active);
    if (!target) {
      console.warn('[CommandExecutor] OPEN target not found:', targetId);
      return;
    }

    target.active = false;
    target.sprite.destroy();
    if (target.label) {
      target.label.destroy();
    }

    if (target.kind === 'chest') {
      this.scene.player.gold += target.gold || 0;
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

  skip(targetId) {
    console.log('[CommandExecutor] SKIP:', targetId);
    this.scene.eventSystem.markEntityResolved(targetId);
    this.scene.addLog(`SKIP resolved: ${targetId}`);
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

  drop(itemId) {
    console.log('[CommandExecutor] DROP:', itemId);
    const removed = this.scene.inventorySystem.remove(itemId);
    if (!removed) {
      console.warn('[CommandExecutor] DROP item not found:', itemId);
      this.scene.addLog(`DROP failed: ${itemId} not found`);
      return;
    }

    this.scene.eventSystem.clearStateEvent('STATE_BAG_FULL');
    this.scene.updateHud();
    this.scene.showStatus(`DROP resolved: ${itemId}`);
    this.scene.addLog(`DROP resolved: ${itemId}`);
  }

  retreat() {
    console.log('[CommandExecutor] RETREAT');
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
}

window.CommandExecutor = CommandExecutor;
