class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.recentEvents = [];
    this.pendingThreatEvents = [];
    this.maxRecentEvents = 8;
    this.debugEnabled = true;
    this.playerHitDebug = null;
    this.playerAttackDebug = null;
    this.playerCooldownDebug = null;
  }

  update() {
    if (this.scene.isRunComplete) {
      return;
    }

    this.updateDebugShapes();
    this.updateEnemies();
    this.updateProjectiles();
  }

  updateEnemies() {
    this.scene.entities.forEach((entity) => {
      if (!entity.active || entity.kind !== 'enemy' || !entity.combat) {
        return;
      }

      this.ensureCombatState(entity);
      this.updateEnemyTimelineDebug(entity);
      const distance = Phaser.Math.Distance.Between(
        this.scene.player.sprite.x,
        this.scene.player.sprite.y,
        entity.sprite.x,
        entity.sprite.y
      );

      if (
        entity.combatState.phase === 'idle' &&
        distance <= entity.combat.range &&
        this.elapsed(entity) >= entity.combat.idleMs
      ) {
        this.setPhase(entity, 'windup');
        this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
      }

      if (entity.combatState.phase === 'windup' && this.elapsed(entity) >= entity.combat.windupMs) {
        this.setPhase(entity, 'attacking');
        this.addCombatEvent('ENEMY_ATTACKING', entity, { attackType: entity.combat.attackType });
        this.performAttack(entity);
      }

      if (entity.combatState.phase === 'attacking' && this.elapsed(entity) >= entity.combat.attackMs) {
        this.setPhase(entity, 'cooldown');
        this.addCombatEvent('ENEMY_COOLDOWN', entity, { attackType: entity.combat.attackType });
      }

      if (entity.combatState.phase === 'cooldown' && this.elapsed(entity) >= entity.combat.cooldownMs) {
        this.setPhase(entity, distance <= entity.combat.range ? 'windup' : 'idle');
        if (entity.combatState.phase === 'windup') {
          this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
        }
      }
    });
  }

  ensureCombatState(entity) {
    if (entity.combatState) {
      return;
    }

    entity.combatState = {
      phase: 'idle',
      phaseStartedAt: this.scene.time.now
    };
    if (this.debugEnabled) {
      entity.combatDebug = this.createEnemyTimelineDebug(entity);
    }
  }

  elapsed(entity) {
    return this.scene.time.now - entity.combatState.phaseStartedAt;
  }

  setPhase(entity, phase) {
    entity.combatState.phase = phase;
    entity.combatState.phaseStartedAt = this.scene.time.now;
  }

  createEnemyTimelineDebug(entity) {
    const vision = this.scene.add.circle(
      entity.sprite.x,
      entity.sprite.y,
      entity.combat.range || 0,
      0xff8a66,
      0.035
    ).setStrokeStyle(1, 0xff8a66, 0.28);
    const hpBg = this.scene.add.rectangle(entity.sprite.x, entity.sprite.y - 58, 58, 5, 0x111116, 0.9);
    const hpFill = this.scene.add.rectangle(entity.sprite.x - 29, entity.sprite.y - 58, 58, 5, 0xff6b6b, 0.95).setOrigin(0, 0.5);
    const text = this.scene.add.text(entity.sprite.x, entity.sprite.y - 52, '空闲', {
      fontSize: '12px',
      color: '#9a9a9a'
    }).setOrigin(0.5, 0);
    const bg = this.scene.add.rectangle(entity.sprite.x, entity.sprite.y - 34, 58, 5, 0x111116, 0.9);
    const fill = this.scene.add.rectangle(entity.sprite.x - 29, entity.sprite.y - 34, 0, 5, 0x9a9a9a, 0.95).setOrigin(0, 0.5);
    vision.setDepth(1);
    hpBg.setDepth(5);
    hpFill.setDepth(6);
    text.setDepth(5);
    bg.setDepth(5);
    fill.setDepth(6);
    return { vision, hpBg, hpFill, text, bg, fill };
  }

  updateEnemyTimelineDebug(entity) {
    if (!this.debugEnabled || !entity.combatDebug) {
      return;
    }

    const phase = entity.combatState.phase;
    const duration = this.getPhaseDuration(entity, phase);
    const progress = Phaser.Math.Clamp(this.elapsed(entity) / duration, 0, 1);
    const color = this.getPhaseColor(phase);

    entity.combatDebug.vision.setPosition(entity.sprite.x, entity.sprite.y);
    entity.combatDebug.vision.setRadius(entity.combat.range || 0);
    entity.combatDebug.text.setText(this.getPhaseLabel(phase));
    entity.combatDebug.text.setColor(this.getPhaseTextColor(phase));
    entity.combatDebug.hpBg.setPosition(entity.sprite.x, entity.sprite.y - 58);
    entity.combatDebug.hpFill.setPosition(entity.sprite.x - 29, entity.sprite.y - 58);
    entity.combatDebug.hpFill.width = 58 * this.getHpRatio(entity);
    entity.combatDebug.text.setPosition(entity.sprite.x, entity.sprite.y - 52);
    entity.combatDebug.bg.setPosition(entity.sprite.x, entity.sprite.y - 34);
    entity.combatDebug.fill.setPosition(entity.sprite.x - 29, entity.sprite.y - 34);
    entity.combatDebug.fill.width = 58 * progress;
    entity.combatDebug.fill.setFillStyle(color, 0.95);
  }

  destroyEntityCombat(entity) {
    if (!entity) {
      return;
    }

    if (entity.combatDebug) {
      entity.combatDebug.vision.destroy();
      entity.combatDebug.hpBg.destroy();
      entity.combatDebug.hpFill.destroy();
      entity.combatDebug.text.destroy();
      entity.combatDebug.bg.destroy();
      entity.combatDebug.fill.destroy();
      entity.combatDebug = null;
    }

    entity.combatState = null;
  }

  clearRoomState(entities = []) {
    entities.forEach((entity) => this.destroyEntityCombat(entity));
    this.projectiles.forEach((projectile) => this.destroyProjectile(projectile));
    this.projectiles = [];
    this.pendingThreatEvents = [];
  }

  getPhaseDuration(entity, phase) {
    if (phase === 'windup') {
      return entity.combat.windupMs;
    }
    if (phase === 'attacking') {
      return entity.combat.attackMs;
    }
    if (phase === 'cooldown') {
      return entity.combat.cooldownMs;
    }
    return entity.combat.idleMs;
  }

  getPhaseColor(phase) {
    const colors = {
      idle: 0x8f887b,
      windup: 0xffd166,
      attacking: 0xff6b6b,
      cooldown: 0x69c0ff
    };
    return colors[phase] || 0x8f887b;
  }

  getPhaseLabel(phase) {
    const labels = {
      idle: '空闲',
      windup: '前摇',
      attacking: '攻击中',
      cooldown: '冷却'
    };
    return labels[phase] || phase;
  }

  getHpRatio(entity) {
    if (!entity.maxHp) {
      return 1;
    }

    return Phaser.Math.Clamp(entity.hp / entity.maxHp, 0, 1);
  }

  getPhaseTextColor(phase) {
    const colors = {
      idle: '#8f887b',
      windup: '#ffd166',
      attacking: '#ff6b6b',
      cooldown: '#69c0ff'
    };
    return colors[phase] || '#8f887b';
  }

  performAttack(entity) {
    if (entity.combat.attackType === 'ranged') {
      this.spawnProjectile(entity);
      return;
    }

    this.performMeleeAttack(entity);
  }

  performMeleeAttack(entity) {
    const distance = Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      entity.sprite.x,
      entity.sprite.y
    );
    const didHit = distance <= entity.combat.hitRange;
    this.showMeleeHitZone(entity, didHit, distance);

    if (!didHit) {
      this.flashText('落空', entity.sprite.x, entity.sprite.y - 42, '#8f887b');
      this.addCombatEvent('ENEMY_ATTACK_MISSED', entity, {
        reason: 'out_of_range',
        distance: Math.ceil(distance),
        hitRange: entity.combat.hitRange
      });
      return;
    }

    this.applyDamage(entity.combat.damage, entity, 'melee');
  }

  showMeleeHitZone(entity, didHit, distance) {
    const color = didHit ? 0xff4f5e : 0x8f887b;
    const alpha = didHit ? 0.2 : 0.12;
    const radius = entity.combat.hitRange;
    const rangeCircle = this.scene.add.circle(entity.sprite.x, entity.sprite.y, radius, color, alpha)
      .setStrokeStyle(2, color, didHit ? 0.75 : 0.45);
    rangeCircle.setDepth(2);

    const dx = this.scene.player.sprite.x - entity.sprite.x;
    const slashWidth = Math.max(18, Math.min(distance, radius));
    const slashX = entity.sprite.x + (dx >= 0 ? slashWidth / 2 : -slashWidth / 2);
    const slash = this.scene.add.rectangle(slashX, entity.sprite.y, slashWidth, 8, color, didHit ? 0.9 : 0.45);
    slash.setDepth(5);

    this.scene.tweens.add({
      targets: [rangeCircle, slash],
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => {
        rangeCircle.destroy();
        slash.destroy();
      }
    });
  }

  showPlayerAttackSwing(target, didHit, distance) {
    const color = didHit ? 0x99ffd8 : 0x8f887b;
    const alpha = didHit ? 0.9 : 0.45;
    const dx = target.sprite.x - this.scene.player.sprite.x;
    const direction = dx >= 0 ? 1 : -1;
    const swingWidth = Math.max(24, Math.min(distance, this.scene.player.attackRange));
    const swingX = this.scene.player.sprite.x + direction * (swingWidth / 2);
    const swing = this.scene.add.rectangle(swingX, this.scene.player.sprite.y, swingWidth, 7, color, alpha);
    const edge = this.scene.add.circle(
      this.scene.player.sprite.x + direction * swingWidth,
      this.scene.player.sprite.y,
      10,
      color,
      didHit ? 0.65 : 0.28
    );

    swing.setDepth(5);
    edge.setDepth(5);
    this.scene.tweens.add({
      targets: [swing, edge],
      alpha: 0,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => {
        swing.destroy();
        edge.destroy();
      }
    });
  }

  spawnProjectile(entity) {
    const projectile = this.scene.add.circle(entity.sprite.x, entity.sprite.y, 7, 0xffd166);
    projectile.setDepth(4);
    const debugCircle = this.debugEnabled
      ? this.scene.add.circle(entity.sprite.x, entity.sprite.y, 7, 0xffd166, 0.18).setStrokeStyle(1, 0xffd166, 0.55)
      : null;
    if (debugCircle) {
      debugCircle.setDepth(3);
    }

    const dx = this.scene.player.sprite.x - entity.sprite.x;
    const targetY = this.scene.player.groundY || this.scene.player.sprite.y;
    const dy = targetY - entity.sprite.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    const projectileId = `projectile_${entity.id}_${Math.round(this.scene.time.now)}`;
    this.projectiles.push({
      id: projectileId,
      sourceId: entity.id,
      sourceType: entity.type,
      sprite: projectile,
      debugCircle,
      vx: (dx / length) * entity.combat.projectileSpeed,
      vy: (dy / length) * entity.combat.projectileSpeed,
      damage: entity.combat.damage,
      ttlMs: entity.combat.projectileTtlMs,
      createdAt: this.scene.time.now
    });
    this.addCombatEvent('PROJECTILE_SPAWNED', entity, {
      projectileType: 'basic',
      projectileId
    });
  }

  updateProjectiles() {
    const deltaSeconds = this.scene.game.loop.delta / 1000;

    this.projectiles = this.projectiles.filter((projectile) => {
      projectile.sprite.x += projectile.vx * deltaSeconds;
      projectile.sprite.y += projectile.vy * deltaSeconds;
      if (projectile.debugCircle) {
        projectile.debugCircle.setPosition(projectile.sprite.x, projectile.sprite.y);
      }

      const age = this.scene.time.now - projectile.createdAt;
      if (age >= projectile.ttlMs) {
        this.destroyProjectile(projectile);
        return false;
      }

      if (this.isProjectileHittingPlayer(projectile)) {
        this.flashText('HIT', projectile.sprite.x, projectile.sprite.y, '#ff6b6b');
        this.destroyProjectile(projectile);
        this.applyDamage(projectile.damage, {
          id: projectile.sourceId,
          type: projectile.sourceType
        }, 'projectile');
        return false;
      }

      this.recordProjectileDodge(projectile);

      return true;
    });
  }

  isProjectileHittingPlayer(projectile) {
    const bounds = this.getPlayerHitBounds();
    const projectileRadius = 7;
    const closestX = Phaser.Math.Clamp(projectile.sprite.x, bounds.left, bounds.right);
    const closestY = Phaser.Math.Clamp(projectile.sprite.y, bounds.top, bounds.bottom);
    const dx = projectile.sprite.x - closestX;
    const dy = projectile.sprite.y - closestY;
    return (dx * dx + dy * dy) <= projectileRadius * projectileRadius;
  }

  getPlayerHitBounds() {
    const sprite = this.scene.player.sprite;
    const width = sprite.width || 42;
    const height = sprite.height || 60;
    return {
      left: sprite.x - width / 2,
      right: sprite.x + width / 2,
      top: sprite.y - height / 2,
      bottom: sprite.y + height / 2,
      width,
      height
    };
  }

  applyDamage(amount, source, damageType) {
    this.scene.player.hp = Math.max(0, this.scene.player.hp - amount);
    if (damageType === 'melee') {
      this.flashText(`-${amount}`, this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#ff6b6b');
    }
    this.addCombatEvent('PLAYER_DAMAGED', source, {
      amount,
      damageType,
      hp: Math.ceil(this.scene.player.hp)
    });
  }

  recordProjectileDodge(projectile) {
    if (projectile.hasRecordedDodge || !this.scene.player.isJumping) {
      return;
    }

    const bounds = this.getPlayerHitBounds();
    const projectileRadius = 7;
    const horizontalGap = Math.abs(projectile.sprite.x - this.scene.player.sprite.x);
    const verticalGap = Math.abs(projectile.sprite.y - this.scene.player.sprite.y);
    if (horizontalGap > bounds.width / 2 + projectileRadius || verticalGap <= bounds.height / 2 + projectileRadius) {
      return;
    }

    projectile.hasRecordedDodge = true;
    this.flashText('DODGE', projectile.sprite.x, projectile.sprite.y - 28, '#69c0ff');
    this.addCombatEvent('PLAYER_DODGED', {
      id: projectile.sourceId,
      type: projectile.sourceType
    }, {
      damageType: 'projectile',
      reason: 'jump'
    });
  }

  destroyProjectile(projectile) {
    projectile.sprite.destroy();
    if (projectile.debugCircle) {
      projectile.debugCircle.destroy();
    }
  }

  updateDebugShapes() {
    if (!this.debugEnabled) {
      return;
    }

    if (!this.playerHitDebug) {
      const bounds = this.getPlayerHitBounds();
      this.playerHitDebug = this.scene.add.rectangle(
        this.scene.player.sprite.x,
        this.scene.player.sprite.y,
        bounds.width,
        bounds.height,
        0x78c2ff,
        0.06
      ).setStrokeStyle(1, 0x78c2ff, 0.55);
      this.playerHitDebug.setDepth(3);
    }

    if (!this.playerAttackDebug) {
      this.playerAttackDebug = this.scene.add.circle(
        this.scene.player.sprite.x,
        this.scene.player.sprite.y,
        this.scene.player.attackRange,
        0x99ffd8,
        0.035
      ).setStrokeStyle(1, 0x99ffd8, 0.35);
      this.playerAttackDebug.setDepth(1);
    }

    if (!this.playerCooldownDebug) {
      const bg = this.scene.add.rectangle(this.scene.player.sprite.x, this.scene.player.sprite.y - 44, 46, 5, 0x111116, 0.9);
      const fill = this.scene.add.rectangle(this.scene.player.sprite.x - 23, this.scene.player.sprite.y - 44, 46, 5, 0x99ffd8, 0.95)
        .setOrigin(0, 0.5);
      bg.setDepth(6);
      fill.setDepth(7);
      this.playerCooldownDebug = { bg, fill };
    }

    this.playerHitDebug.setPosition(this.scene.player.sprite.x, this.scene.player.sprite.y);
    this.playerAttackDebug.setPosition(this.scene.player.sprite.x, this.scene.player.sprite.y);
    this.playerAttackDebug.setRadius(this.scene.player.attackRange);
    this.updatePlayerCooldownDebug();
  }

  updatePlayerCooldownDebug() {
    if (!this.playerCooldownDebug) {
      return;
    }

    const now = this.scene.time.now;
    const cooldownMs = this.scene.player.attackCooldownMs || 1;
    const elapsed = now - this.scene.player.lastAttackAt;
    const progress = this.scene.player.lastAttackAt === -Infinity
      ? 1
      : Phaser.Math.Clamp(elapsed / cooldownMs, 0, 1);
    const x = this.scene.player.sprite.x;
    const y = this.scene.player.sprite.y - 44;

    this.playerCooldownDebug.bg.setPosition(x, y);
    this.playerCooldownDebug.fill.setPosition(x - 23, y);
    this.playerCooldownDebug.fill.width = 46 * progress;
    this.playerCooldownDebug.fill.setFillStyle(progress >= 1 ? 0x99ffd8 : 0x69c0ff, 0.95);
  }

  flashText(text, x, y, color) {
    const label = this.scene.add.text(x, y, text, {
      fontSize: '14px',
      color
    });
    label.setDepth(6);
    this.scene.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy()
    });
  }

  addCombatEvent(type, source, details = {}) {
    const event = {
      time: Math.round(this.scene.time.now),
      type,
      sourceId: source.id,
      sourceType: source.type,
      details
    };

    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    if (type === 'ENEMY_WINDUP' || type === 'ENEMY_COOLDOWN' || type === 'PROJECTILE_SPAWNED') {
      this.pendingThreatEvents.push(event);
    }

    this.scene.recordRunEvent(type, {
      sourceId: source.id,
      sourceType: source.type,
      ...details
    });
    this.scene.addLog(`Combat: ${type} ${source.type}`);
  }

  getRecentEventsSnapshot() {
    return this.recentEvents.map((event) => ({
      time: event.time,
      type: event.type,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      details: event.details
    }));
  }

  getThreatsSnapshot() {
    return this.scene.entities
      .filter((entity) => {
        return entity.active &&
          entity.kind === 'enemy' &&
          entity.combat &&
          entity.combatState &&
          (entity.combatState.phase === 'windup' || entity.combatState.phase === 'attacking');
      })
      .map((entity) => {
        const phase = entity.combatState.phase;
        const phaseDuration = this.getPhaseDuration(entity, phase);
        const elapsed = this.elapsed(entity);
        const remainingMs = Math.max(0, phaseDuration - elapsed);

        return {
          sourceId: entity.id,
          sourceType: entity.type,
          attackType: entity.combat.attackType,
          phase,
          phaseElapsedMs: Math.ceil(elapsed),
          phaseProgress: Phaser.Math.Clamp(elapsed / phaseDuration, 0, 1),
          timeToAttackMs: phase === 'windup' ? Math.ceil(remainingMs) : 0,
          damage: entity.combat.damage,
          direction: StateSnapshot.getDirection(this.scene.player, entity),
          distance: StateSnapshot.getDistance(this.scene.player, entity)
        };
      });
  }

  getProjectilesSnapshot() {
    return this.projectiles.map((projectile) => {
      const dx = projectile.sprite.x - this.scene.player.sprite.x;
      const dy = projectile.sprite.y - this.scene.player.sprite.y;
      const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);

      return {
        id: projectile.id,
        sourceId: projectile.sourceId,
        sourceType: projectile.sourceType,
        direction: this.getPointDirection(dx, dy),
        distance: this.getPointDistance(dx, dy),
        x: Math.round(projectile.sprite.x),
        y: Math.round(projectile.sprite.y),
        vx: Math.round(projectile.vx),
        vy: Math.round(projectile.vy),
        speed: Math.round(speed),
        damage: projectile.damage,
        ageMs: Math.max(0, Math.round(this.scene.time.now - projectile.createdAt)),
        ttlMs: projectile.ttlMs,
        horizontalGap: Math.round(Math.abs(dx)),
        verticalGap: Math.round(Math.abs(dy)),
        incoming: this.isProjectileIncoming(projectile)
      };
    });
  }

  getLastEventSnapshot(type) {
    const event = [...this.recentEvents].reverse().find((recentEvent) => recentEvent.type === type);
    if (!event) {
      return null;
    }

    return {
      time: event.time,
      type: event.type,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      details: event.details
    };
  }

  isProjectileIncoming(projectile) {
    const dx = this.scene.player.sprite.x - projectile.sprite.x;
    const dy = this.scene.player.sprite.y - projectile.sprite.y;
    return (dx * projectile.vx + dy * projectile.vy) > 0;
  }

  getPointDirection(dx, dy) {
    const horizontal = dx < -20 ? 'left' : dx > 20 ? 'right' : '';
    const vertical = dy < -20 ? 'up' : dy > 20 ? 'down' : '';

    if (horizontal && vertical) {
      return `${horizontal}_${vertical}`;
    }
    return horizontal || vertical || 'same';
  }

  getPointDistance(dx, dy) {
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 120) {
      return 'near';
    }
    if (distance < 260) {
      return 'mid';
    }
    return 'far';
  }

  consumeThreatEvent(strategyConfig = {}) {
    const config = StrategyConfig.normalize(strategyConfig);
    while (this.pendingThreatEvents.length > 0) {
      const event = this.pendingThreatEvents[0];

      if (!this.isThreatEventStillValid(event)) {
        this.pendingThreatEvents.shift();
        continue;
      }

      if (!this.isThreatResponseEnabled(event, config)) {
        this.pendingThreatEvents.shift();
        this.recordThreatIgnored(event, 'response_disabled');
        continue;
      }

      if (!this.isThreatReady(event, config)) {
        return null;
      }

      if (this.scene.time.now - event.time < this.getThreatReactionDelay(event, config)) {
        return null;
      }

      if (!this.canRespondToThreat(event)) {
        this.pendingThreatEvents.shift();
        this.recordThreatIgnored(event, 'already_jumping');
        continue;
      }

      return this.prepareThreatForDispatch(this.pendingThreatEvents.shift(), config);
    }

    return null;
  }

  isThreatResponseEnabled(event, config) {
    const rule = StrategyConfig.getCombatRule(config, event.sourceType, event.type);
    return !rule || rule.responseAction !== 'wait';
  }

  isThreatReady(event, config) {
    if (event.type !== 'PROJECTILE_SPAWNED') {
      return true;
    }

    const projectile = this.findProjectileByThreatEvent(event);
    if (!projectile || !this.isProjectileIncoming(projectile)) {
      return false;
    }

    const distance = this.getProjectileDistance(projectile);
    const rule = StrategyConfig.getCombatRule(config, event.sourceType, event.type);
    const responseDistance = rule ? rule.distance : config.dodgeProjectileDistance;
    if (!this.isDistanceWithinResponse(distance, responseDistance)) {
      projectile.responseEnteredAt = null;
      return false;
    }

    if (projectile.responseEnteredAt === undefined || projectile.responseEnteredAt === null) {
      projectile.responseEnteredAt = this.scene.time.now;
      projectile.responseDistance = distance;
      this.recordThreatEvent('PROJECTILE_RESPONSE_WINDOW_ENTERED', event, {
        projectileId: projectile.id,
        distance,
        responseDistance
      });
    }

    return this.scene.time.now - projectile.responseEnteredAt >= (rule ? rule.delayMs : 0);
  }

  prepareThreatForDispatch(event, config) {
    if (event.type === 'PROJECTILE_SPAWNED') {
      const projectile = this.findProjectileByThreatEvent(event);
      const responseElapsedMs = projectile && projectile.responseEnteredAt
        ? Math.round(this.scene.time.now - projectile.responseEnteredAt)
        : 0;
      event.details = {
        ...event.details,
        responseDistance: (StrategyConfig.getCombatRule(config, event.sourceType, event.type) || {}).distance,
        responseDelayMs: ((StrategyConfig.getCombatRule(config, event.sourceType, event.type) || {}).delayMs || 0),
        responseElapsedMs
      };
      return event;
    }

    event.details = {
      ...event.details,
      responseDelayMs: this.getThreatReactionDelay(event, config)
    };
    return event;
  }

  getThreatReactionDelay(event, config) {
    if (event.type === 'PROJECTILE_SPAWNED') {
      const projectile = this.findProjectileByThreatEvent(event);
      if (projectile && projectile.responseEnteredAt) {
        return 0;
      }
    }

    const rule = StrategyConfig.getCombatRule(config, event.sourceType, event.type);
    return rule ? rule.delayMs : 0;
  }

  canRespondToThreat() {
    return !this.scene.player.isJumping;
  }

  recordThreatIgnored(event, reason) {
    this.recordThreatEvent('COMBAT_THREAT_IGNORED', event, {
      reason,
      threatType: event.type
    });
  }

  recordThreatEvent(type, event, details) {
    this.recentEvents.push({
      time: Math.round(this.scene.time.now),
      type,
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      details
    });
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    this.scene.recordRunEvent(type, {
      sourceId: event.sourceId,
      sourceType: event.sourceType,
      ...details
    });
    this.scene.addLog(`${type}: ${event.type}`);
  }

  isThreatEventStillValid(event) {
    if (event.type === 'PROJECTILE_SPAWNED') {
      return Boolean(this.findProjectileByThreatEvent(event));
    }

    if (event.type === 'ENEMY_WINDUP') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        (source.combatState.phase === 'windup' || source.combatState.phase === 'attacking')
      );
    }

    if (event.type === 'ENEMY_COOLDOWN') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        source.combatState.phase === 'cooldown'
      );
    }

    return true;
  }

  findProjectileByThreatEvent(event) {
    return this.projectiles.find((projectile) => projectile.id === event.details.projectileId) || null;
  }

  getProjectileDistance(projectile) {
    const dx = projectile.sprite.x - this.scene.player.sprite.x;
    const dy = projectile.sprite.y - this.scene.player.sprite.y;
    return this.getPointDistance(dx, dy);
  }

  isDistanceWithinResponse(distance, responseDistance) {
    const distanceRank = { near: 1, mid: 2, far: 3 };
    return distanceRank[distance] <= distanceRank[responseDistance || 'near'];
  }
}

globalThis.CombatSystem = CombatSystem;
