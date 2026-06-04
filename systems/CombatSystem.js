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
    this.updateSilentTargeting();
    this.updateEnemies();
    this.updateProjectiles();
    this.resolvePlayerEnemyBodyCollisions();
  }

  updateSilentTargeting() {
    const enemies = this.scene.entities.filter((entity) => {
      return entity.active && entity.kind === 'enemy' && entity.sprite;
    });
    const nearestEnemy = enemies
      .map((entity) => ({
        entity,
        distance: Math.abs(entity.sprite.x - this.scene.player.sprite.x)
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearestEnemy) {
      this.scene.player.currentTargetId = null;
      return;
    }

    this.scene.player.currentTargetId = nearestEnemy.entity.id;
    if (!this.scene.player.isBackstepping) {
      this.scene.player.facing = nearestEnemy.entity.sprite.x < this.scene.player.sprite.x ? -1 : 1;
    }

    enemies.forEach((entity) => {
      entity.facing = this.scene.player.sprite.x < entity.sprite.x ? -1 : 1;
      if (entity.combatState) {
        entity.combatState.currentTargetId = this.scene.player.id;
      }
    });
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

      if (entity.combat.behavior === 'boss_floor1') {
        this.updateBossFloor1(entity);
        return;
      }

      if (entity.combat.attackType === 'melee') {
        this.updateMeleeEnemy(entity, distance);
        return;
      }

      if (entity.combat.attackType === 'contact') {
        this.updateContactEnemy(entity);
        return;
      }

      if (entity.combat.attackType === 'ranged') {
        this.updateRangedEnemy(entity, distance);
        return;
      }

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

  updateBossFloor1(entity) {
    if (entity.hp <= 0) {
      this.setPhase(entity, 'dead');
      return;
    }

    if (this.shouldTriggerBossPhase2(entity)) {
      this.startBossPhase2(entity);
      return;
    }

    const phase = entity.combatState.phase;

    if (phase === 'boss_charge_windup' && this.elapsed(entity) >= entity.combat.chargeWindupMs) {
      this.startBossCharge(entity);
      return;
    }

    if (phase === 'boss_charging') {
      this.updateBossCharge(entity);
      return;
    }

    if (phase === 'boss_stunned_a' && this.elapsed(entity) >= entity.combat.stunOnWallMs) {
      this.startBossReposition(entity);
      return;
    }

    if (phase === 'boss_normal_windup' && this.elapsed(entity) >= entity.combat.normalWindupMs) {
      this.setPhase(entity, 'boss_normal_attacking');
      this.addCombatEvent('BOSS_NORMAL_ATTACKING', entity, { attackType: 'boss_normal' });
      this.performBossNormalAttack(entity);
      return;
    }

    if (phase === 'boss_normal_windup') {
      this.updateBossSlowApproach(entity, (entity.combat.normalAttackRange || 95) * 0.75);
      return;
    }

    if (phase === 'boss_normal_attacking' && this.elapsed(entity) >= entity.combat.normalAttackMs) {
      this.setPhase(entity, 'boss_normal_cooldown');
      this.addCombatEvent('BOSS_NORMAL_COOLDOWN', entity, { attackType: 'boss_normal' });
      return;
    }

    if (phase === 'boss_normal_cooldown' && this.elapsed(entity) >= entity.combat.normalCooldownMs) {
      this.chooseBossNextAction(entity);
      return;
    }

    if (phase === 'boss_normal_cooldown') {
      this.updateBossSlowApproach(entity, entity.combat.normalAttackRange || 95);
      return;
    }

    if (phase === 'boss_reposition') {
      this.updateBossReposition(entity);
      if (this.elapsed(entity) >= (entity.combat.repositionMs || 650)) {
        this.chooseBossNextAction(entity);
      }
      return;
    }

    if (phase === 'boss_phase2_trigger' && this.elapsed(entity) >= entity.combat.phase2TriggerMs) {
      this.chooseBossNextAction(entity);
      return;
    }

    if (phase.startsWith('boss_triple_hit_')) {
      this.updateBossTripleHit(entity);
      return;
    }

    if (phase.startsWith('boss_triple_wait_')) {
      this.updateBossTripleWait(entity);
      return;
    }

    if (phase === 'boss_stunned_b' && this.elapsed(entity) >= entity.combat.stunAfterTripleMs) {
      this.chooseBossNextAction(entity);
    }
  }

  shouldTriggerBossPhase2(entity) {
    if (entity.combatState.phase2Started) {
      return false;
    }

    const threshold = entity.maxHp * (entity.combat.phase2Threshold || 0.4);
    const interruptible = entity.combatState.phase === 'boss_charge_windup' ||
      entity.combatState.phase === 'boss_normal_cooldown';
    return entity.hp <= threshold && interruptible;
  }

  startBossPhase2(entity) {
    entity.combatState.phase2Started = true;
    this.setPhase(entity, 'boss_phase2_trigger');
    this.addCombatEvent('BOSS_PHASE2_TRIGGER', entity, { threshold: entity.combat.phase2Threshold || 0.4 });
  }

  startBossChargeWindup(entity) {
    const direction = this.scene.player.sprite.x >= entity.sprite.x ? 1 : -1;
    entity.combatState.pendingChargeDirection = direction;
    entity.combatState.lastChargeSkillAt = this.scene.time.now;
    entity.combatState.lastBossSkillAt = this.scene.time.now;
    entity.combatState.normalsSinceLastSkill = 0;
    this.applyBossChargeWindupBackstep(entity, direction);
    this.setPhase(entity, 'boss_charge_windup');
    this.showBossChargePath(entity, direction);
    this.addCombatEvent('BOSS_CHARGE_WINDUP', entity, { attackType: 'boss_charge' });
  }

  applyBossChargeWindupBackstep(entity, chargeDirection) {
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 72) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const backstepDirection = -chargeDirection;
    const distance = entity.combat.chargeWindupBackstep || 44;
    const startX = entity.sprite.x;
    const nextX = Phaser.Math.Clamp(entity.sprite.x + backstepDirection * distance, roomLeft, roomRight);
    const resolvedX = this.resolveEnemyPlayerBlocking(entity, nextX);

    if (Math.abs(resolvedX - startX) < 2) {
      return;
    }

    if (entity.combatState.chargeBackstepTween) {
      entity.combatState.chargeBackstepTween.stop();
    }
    entity.combatState.chargeBackstepTween = this.scene.tweens.add({
      targets: entity.sprite,
      x: resolvedX,
      duration: entity.combat.chargeWindupBackstepMs || 180,
      ease: 'Sine.easeOut',
      onUpdate: () => this.updateMovingEntity(entity),
      onComplete: () => {
        entity.combatState.chargeBackstepTween = null;
        this.updateMovingEntity(entity);
      }
    });
    this.addCombatEvent('BOSS_CHARGE_BACKSTEP', entity, {
      attackType: 'boss_charge',
      direction: backstepDirection > 0 ? 'right' : 'left',
      distance: Math.round(Math.abs(resolvedX - startX))
    });
  }

  startBossCharge(entity) {
    const direction = entity.combatState.pendingChargeDirection ||
      (this.scene.player.sprite.x >= entity.sprite.x ? 1 : -1);
    entity.combatState.chargeDirection = direction;
    entity.combatState.chargeHitResolved = false;
    entity.combatState.pendingChargeDirection = null;
    this.setPhase(entity, 'boss_charging');
    this.addCombatEvent('BOSS_CHARGING', entity, { attackType: 'boss_charge', direction: direction > 0 ? 'right' : 'left' });
  }

  updateBossCharge(entity) {
    const direction = entity.combatState.chargeDirection || -1;
    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 72) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const nextX = entity.sprite.x + direction * entity.combat.chargeSpeed * deltaSeconds;

    entity.sprite.x = Phaser.Math.Clamp(nextX, roomLeft, roomRight);
    this.updateMovingEntity(entity);

    if (!entity.combatState.chargeHitResolved && this.isPlayerTouchingEntity(entity)) {
      this.flashText('撞击', entity.sprite.x, entity.sprite.y - 54, '#ff6b6b');
      this.addCombatEvent('BOSS_CHARGE_HIT', entity, {
        attackType: 'boss_charge',
        damage: entity.combat.chargeDamage,
        continued: true
      });
      this.applyDamage(entity.combat.chargeDamage, entity, 'boss_charge');
      entity.combatState.chargeHitResolved = true;
    }

    if (entity.sprite.x <= roomLeft || entity.sprite.x >= roomRight) {
      this.setPhase(entity, 'boss_stunned_a');
      this.flashText('鐪╂檿', entity.sprite.x, entity.sprite.y - 54, '#69c0ff');
      this.addCombatEvent('BOSS_STUNNED_A', entity, { durationMs: entity.combat.stunOnWallMs });
    }
  }

  startBossNormalWindup(entity) {
    this.facePlayer(entity);
    this.setPhase(entity, 'boss_normal_windup');
    this.addCombatEvent('BOSS_NORMAL_WINDUP', entity, {
      attackType: 'boss_normal',
      hitRange: entity.combat.normalAttackRange
    });
  }

  startBossReposition(entity) {
    entity.combatState.repositionTargetX = this.getBossRepositionTargetX(entity);
    if (!Number.isFinite(entity.combatState.repositionTargetX)) {
      this.chooseBossNextAction(entity);
      return;
    }

    this.setPhase(entity, 'boss_reposition');
    this.addCombatEvent('BOSS_REPOSITION', entity, {
      reason: 'wall_recover',
      targetX: Math.round(entity.combatState.repositionTargetX),
      durationMs: entity.combat.repositionMs || 650
    });
  }

  updateBossReposition(entity) {
    if (Number.isFinite(entity.combatState.repositionTargetX)) {
      this.updateBossRepositionToTarget(entity);
      return;
    }

    this.chooseBossNextAction(entity);
  }

  getBossRepositionTargetX(entity) {
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 72) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const wallPadding = 18;
    const isAtLeftWall = entity.sprite.x <= roomLeft + wallPadding;
    const isAtRightWall = entity.sprite.x >= roomRight - wallPadding;

    if (isAtLeftWall || isAtRightWall) {
      const directionFromWall = isAtLeftWall ? 1 : -1;
      const recoverDistance = entity.combat.wallRecoverDistance || 150;
      return Phaser.Math.Clamp(entity.sprite.x + directionFromWall * recoverDistance, roomLeft, roomRight);
    }

    return null;
  }

  updateBossRepositionToTarget(entity) {
    const targetX = entity.combatState.repositionTargetX;
    const delta = targetX - entity.sprite.x;
    const absDelta = Math.abs(delta);
    if (absDelta <= 3) {
      entity.sprite.x = targetX;
      entity.combatState.repositionTargetX = null;
      this.updateMovingEntity(entity);
      this.facePlayer(entity);
      return;
    }

    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const speed = entity.combat.repositionMoveSpeed || entity.combat.normalMoveSpeed || 90;
    const step = Math.min(absDelta, speed * deltaSeconds);
    const nextX = entity.sprite.x + Math.sign(delta) * step;

    entity.sprite.x = this.resolveEnemyPlayerBlocking(entity, nextX);
    if (entity.sprite.x === nextX || Math.abs(entity.sprite.x - targetX) < absDelta) {
      this.updateMovingEntity(entity);
      this.facePlayer(entity);
      return;
    }

    entity.combatState.repositionTargetX = null;
    this.updateMovingEntity(entity);
    this.facePlayer(entity);
  }

  updateBossSlowApproach(entity, stopGap) {
    const distance = this.getPlayerEntityBoundsDistance(entity);
    if (distance <= stopGap) {
      this.facePlayer(entity);
      return;
    }

    const dx = this.scene.player.sprite.x - entity.sprite.x;
    const direction = dx >= 0 ? 1 : -1;
    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const speed = entity.combat.approachMoveSpeed || 42;
    const step = Math.min(distance - stopGap, speed * deltaSeconds);
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 72) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const nextX = Phaser.Math.Clamp(entity.sprite.x + direction * step, roomLeft, roomRight);

    entity.sprite.x = this.resolveEnemyPlayerBlocking(entity, nextX);
    this.updateMovingEntity(entity);
    this.facePlayer(entity);
  }

  performBossNormalAttack(entity) {
    this.facePlayer(entity);
    entity.combatState.normalsSinceLastSkill = (entity.combatState.normalsSinceLastSkill || 0) + 1;
    const didHit = this.resolveBossMeleeHit(entity, entity.combat.normalAttackRange, entity.combat.normalAttackDamage, 'boss_normal');
    this.addCombatEvent(didHit ? 'BOSS_NORMAL_HIT' : 'BOSS_NORMAL_MISSED', entity, {
      attackType: 'boss_normal',
      damage: entity.combat.normalAttackDamage,
      hitRange: entity.combat.normalAttackRange
    });
  }

  startBossTripleHit(entity, hitIndex) {
    if (hitIndex === 1) {
      entity.combatState.lastTripleSkillAt = this.scene.time.now;
      entity.combatState.lastBossSkillAt = this.scene.time.now;
      entity.combatState.normalsSinceLastSkill = 0;
    }
    entity.combatState.tripleHitIndex = hitIndex;
    entity.combatState.tripleHitResolved = false;
    this.setPhase(entity, `boss_triple_hit_${hitIndex}`);
    this.addCombatEvent('BOSS_TRIPLE_HIT', entity, {
      attackType: 'boss_triple',
      hitIndex,
      hitCount: 3,
      damage: entity.combat.tripleHitDamage
    });
  }

  updateBossTripleHit(entity) {
    const hitIndex = entity.combatState.tripleHitIndex || 1;
    if (!entity.combatState.tripleHitResolved) {
      entity.combatState.tripleHitResolved = true;
      this.facePlayer(entity);
      this.resolveBossMeleeHit(entity, entity.combat.normalAttackRange, entity.combat.tripleHitDamage, 'boss_triple');
    }

    if (this.elapsed(entity) < entity.combat.tripleHitAttackMs) {
      return;
    }

    if (hitIndex >= 3) {
      this.setPhase(entity, 'boss_stunned_b');
      this.flashText('纭洿', entity.sprite.x, entity.sprite.y - 54, '#69c0ff');
      this.addCombatEvent('BOSS_STUNNED_B', entity, { durationMs: entity.combat.stunAfterTripleMs });
      return;
    }

    this.setPhase(entity, `boss_triple_wait_${hitIndex}`);
  }

  updateBossTripleWait(entity) {
    const hitIndex = entity.combatState.tripleHitIndex || 1;
    if (this.elapsed(entity) >= entity.combat.tripleHitInterval) {
      this.startBossTripleHit(entity, hitIndex + 1);
    }
  }

  chooseBossNextAction(entity) {
    const canUseSkill = entity.combatState.lastBossSkillAt === undefined ||
      (entity.combatState.normalsSinceLastSkill || 0) > 0;
    const distance = this.getPlayerEntityBoundsDistance(entity);
    const normalAttackRange = entity.combat.normalAttackRange || 95;

    if (canUseSkill && entity.combatState.phase2Started && this.isBossSkillReady(entity, 'triple')) {
      this.startBossTripleHit(entity, 1);
      return;
    }

    if (canUseSkill && this.isBossSkillReady(entity, 'charge')) {
      this.startBossChargeWindup(entity);
      return;
    }

    this.startBossNormalWindup(entity);
  }

  isBossSkillReady(entity, skill) {
    const now = this.scene.time.now;
    if (skill === 'charge') {
      const cooldownMs = entity.combat.chargeCooldownMs || 10000;
      const lastUsedAt = entity.combatState.lastChargeSkillAt;
      return lastUsedAt === undefined || now - lastUsedAt >= cooldownMs;
    }

    if (skill === 'triple') {
      const cooldownMs = entity.combat.tripleHitCooldownMs || 10000;
      const lastUsedAt = entity.combatState.lastTripleSkillAt;
      return lastUsedAt === undefined || now - lastUsedAt >= cooldownMs;
    }

    return false;
  }

  resolveBossMeleeHit(entity, hitRange, damage, damageType) {
    const distance = this.getPlayerEntityBoundsDistance(entity);
    const didHit = distance <= hitRange;
    this.showMeleeHitZone({
      ...entity,
      combat: {
        ...entity.combat,
        hitRange
      }
    }, didHit, distance);

    if (!didHit) {
      this.flashText('钀界┖', entity.sprite.x, entity.sprite.y - 54, '#8f887b');
      return false;
    }

    this.applyDamage(damage, entity, damageType);
    return true;
  }

  facePlayer(entity) {
    entity.facing = this.scene.player.sprite.x < entity.sprite.x ? -1 : 1;
    if (entity.combatState) {
      entity.combatState.currentTargetId = this.scene.player.id;
    }
  }

  showBossChargePath(entity, direction) {
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 72) / 2;
    const wallX = direction > 0
      ? roomFrame.x + roomFrame.width / 2 - halfWidth
      : roomFrame.x - roomFrame.width / 2 + halfWidth;
    this.showChargePath(entity, wallX, true);
  }

  updateRangedEnemy(entity, distance) {
    if (
      entity.combatState.phase === 'idle' &&
      distance <= entity.combat.range &&
      this.elapsed(entity) >= entity.combat.idleMs
    ) {
      this.setPhase(entity, 'windup');
      this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
      return;
    }

    if (entity.combatState.phase === 'windup' && this.elapsed(entity) >= entity.combat.windupMs) {
      this.setPhase(entity, 'attacking');
      entity.combatState.burstShotsFired = 0;
      entity.combatState.lastBurstShotAt = -Infinity;
      this.addCombatEvent('ENEMY_ATTACKING', entity, { attackType: entity.combat.attackType });
      this.fireRangedBurstShot(entity);
      return;
    }

    if (entity.combatState.phase === 'attacking') {
      this.updateRangedBurst(entity);
      if (this.isRangedAttackComplete(entity)) {
        this.setPhase(entity, 'cooldown');
        this.addCombatEvent('ENEMY_COOLDOWN', entity, { attackType: entity.combat.attackType });
      }
      return;
    }

    if (entity.combatState.phase === 'cooldown' && this.elapsed(entity) >= entity.combat.cooldownMs) {
      this.setPhase(entity, distance <= entity.combat.range ? 'windup' : 'idle');
      if (entity.combatState.phase === 'windup') {
        this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
      }
    }
  }

  updateRangedBurst(entity) {
    const burstCount = entity.combat.burstCount || 1;
    if (burstCount <= 1) {
      return;
    }

    const interval = entity.combat.burstInterval || entity.combat.projectileInterval || 300;
    const canFire = entity.combatState.burstShotsFired < burstCount &&
      this.scene.time.now - entity.combatState.lastBurstShotAt >= interval;
    if (canFire) {
      this.fireRangedBurstShot(entity);
    }
  }

  fireRangedBurstShot(entity) {
    entity.combatState.burstShotsFired = (entity.combatState.burstShotsFired || 0) + 1;
    entity.combatState.lastBurstShotAt = this.scene.time.now;
    this.spawnProjectile(entity, {
      burstIndex: entity.combatState.burstShotsFired,
      burstCount: entity.combat.burstCount || 1
    });
  }

  isRangedAttackComplete(entity) {
    const burstCount = entity.combat.burstCount || 1;
    if (burstCount <= 1) {
      return this.elapsed(entity) >= entity.combat.attackMs;
    }

    return entity.combatState.burstShotsFired >= burstCount;
  }

  updateMeleeEnemy(entity, distance) {
    const aggroRange = entity.combat.aggroRange || entity.combat.range || entity.combat.hitRange;
    const attackRange = entity.combat.attackRange || entity.combat.hitRange || entity.combat.range;

    if (entity.combatState.phase === 'patrolling') {
      if (distance <= aggroRange) {
        this.setPhase(entity, 'chasing');
        this.addCombatEvent('ENEMY_CHASING', entity, { attackType: entity.combat.attackType });
      } else {
        this.patrolEnemy(entity);
        return;
      }
    }

    if (entity.combatState.phase === 'chasing') {
      if (distance > aggroRange) {
        this.setPhase(entity, 'patrolling');
        return;
      }

      if (distance <= attackRange) {
        this.setPhase(entity, 'windup');
        this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
        return;
      }

      this.chasePlayer(entity, attackRange);
      return;
    }

    if (entity.combatState.phase === 'windup' && this.elapsed(entity) >= entity.combat.windupMs) {
      this.setPhase(entity, 'attacking');
      this.addCombatEvent('ENEMY_ATTACKING', entity, { attackType: entity.combat.attackType });
      this.performAttack(entity);
      return;
    }

    if (entity.combatState.phase === 'attacking' && this.elapsed(entity) >= entity.combat.attackMs) {
      this.setPhase(entity, 'cooldown');
      this.addCombatEvent('ENEMY_COOLDOWN', entity, { attackType: entity.combat.attackType });
      return;
    }

    if (entity.combatState.phase === 'cooldown' && this.elapsed(entity) >= entity.combat.cooldownMs) {
      if (distance <= attackRange) {
        this.setPhase(entity, 'windup');
        this.addCombatEvent('ENEMY_WINDUP', entity, { attackType: entity.combat.attackType });
        return;
      }

      if (distance <= aggroRange) {
        this.setPhase(entity, 'chasing');
        this.addCombatEvent('ENEMY_CHASING', entity, { attackType: entity.combat.attackType });
        return;
      }

      this.setPhase(entity, 'patrolling');
    }
  }

  chasePlayer(entity, stopRange) {
    const dx = this.scene.player.sprite.x - entity.sprite.x;
    const absDx = Math.abs(dx);
    if (absDx <= stopRange) {
      return;
    }

    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const speed = entity.combat.moveSpeed || 24;
    const step = Math.min(absDx - stopRange, speed * deltaSeconds);
    entity.sprite.x += Math.sign(dx) * step;
    this.updateMovingEntity(entity);
  }

  updateContactEnemy(entity) {
    if (entity.combat.behavior !== 'static') {
      this.patrolEnemy(entity);
    }

    if (!this.isPlayerTouchingEntity(entity)) {
      return;
    }

    const now = this.scene.time.now;
    const cooldownMs = entity.combat.contactCooldownMs || 800;
    if (entity.combatState.lastContactHitAt && now - entity.combatState.lastContactHitAt < cooldownMs) {
      return;
    }

    entity.combatState.lastContactHitAt = now;
    this.addCombatEvent('ENEMY_CONTACT_HIT', entity, {
      attackType: entity.combat.attackType,
      damage: entity.combat.contactDamage
    });
    this.applyDamage(entity.combat.contactDamage, entity, 'contact');
  }

  isPlayerTouchingEntity(entity) {
    const playerBounds = this.getPlayerHitBounds();
    const enemyBounds = entity.sprite.getBounds();
    return playerBounds.right >= enemyBounds.left &&
      playerBounds.left <= enemyBounds.right &&
      playerBounds.bottom >= enemyBounds.top &&
      playerBounds.top <= enemyBounds.bottom;
  }

  resolveEnemyPlayerBlocking(entity, nextX) {
    const currentX = entity.sprite.x;
    if (nextX === currentX) {
      return nextX;
    }

    const player = this.scene.player;
    const direction = nextX > currentX ? 1 : -1;
    const entityHalfWidth = (entity.sprite.width || 42) / 2;
    const playerHalfWidth = (player.sprite.width || 42) / 2;
    const verticalGap = Math.abs(entity.sprite.y - player.sprite.y);
    const combinedHalfHeight = ((entity.sprite.height || 42) + (player.sprite.height || 42)) / 2;
    if (verticalGap >= combinedHalfHeight) {
      return nextX;
    }

    if (direction > 0) {
      const entityRightNow = currentX + entityHalfWidth;
      const entityRightNext = nextX + entityHalfWidth;
      const playerLeft = player.sprite.x - playerHalfWidth;
      if (entityRightNow <= playerLeft && entityRightNext > playerLeft) {
        return playerLeft - entityHalfWidth - 2;
      }
      return nextX;
    }

    const entityLeftNow = currentX - entityHalfWidth;
    const entityLeftNext = nextX - entityHalfWidth;
    const playerRight = player.sprite.x + playerHalfWidth;
    if (entityLeftNow >= playerRight && entityLeftNext < playerRight) {
      return playerRight + entityHalfWidth + 2;
    }

    return nextX;
  }

  resolvePlayerEnemyBodyCollisions() {
    this.scene.entities.forEach((entity) => {
      if (!entity.active || entity.kind !== 'enemy' || !entity.sprite) {
        return;
      }

      const overlap = this.getPlayerEnemyOverlap(entity);
      if (!overlap) {
        return;
      }

      this.applyBodyCollisionDamage(entity);
    });
  }

  getPlayerEnemyOverlap(entity) {
    const playerBounds = this.getPlayerHitBounds();
    const enemyBounds = entity.sprite.getBounds();
    const overlapX = Math.min(playerBounds.right, enemyBounds.right) - Math.max(playerBounds.left, enemyBounds.left);
    const overlapY = Math.min(playerBounds.bottom, enemyBounds.bottom) - Math.max(playerBounds.top, enemyBounds.top);

    if (overlapX <= 0 || overlapY <= 0) {
      return null;
    }

    return { x: overlapX, y: overlapY };
  }

  knockbackPlayerFromEntity(entity, distance = 64) {
    const player = this.scene.player;
    const direction = player.sprite.x <= entity.sprite.x ? -1 : 1;
    this.knockbackPlayerFromDirection(direction, distance, {
      lift: 18,
      durationMs: 220,
      reason: 'body_collision'
    });
  }

  knockbackPlayerFromDirection(direction, distance = 64, options = {}) {
    const player = this.scene.player;
    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const playerWidth = player.sprite.width || 42;
    const halfWidth = playerWidth / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const normalizedDirection = direction < 0 ? -1 : 1;
    const startX = player.sprite.x;
    const startY = player.sprite.y;
    const targetX = Phaser.Math.Clamp(startX + normalizedDirection * distance, roomLeft, roomRight);
    const lift = Math.max(0, options.lift || 0);
    const durationMs = Math.max(120, options.durationMs || 240);

    if (this.scene.movementSystem) {
      this.scene.movementSystem.finishManualMove('knockback');
    } else {
      player.manualMove = null;
    }

    if (player.knockbackTween) {
      player.knockbackTween.stop();
    }
    if (player.knockbackLiftTween) {
      player.knockbackLiftTween.stop();
    }

    player.facing = normalizedDirection;
    player.currentMovementAction = 'KNOCKBACK';
    player.movementActionUntil = this.scene.time.now + durationMs;

    player.knockbackTween = this.scene.tweens.add({
      targets: player.sprite,
      x: targetX,
      duration: durationMs,
      ease: 'Sine.easeOut',
      onUpdate: () => this.updatePlayerAfterKnockback(),
      onComplete: () => {
        player.knockbackTween = null;
        this.finishPlayerKnockback();
      }
    });

    if (lift > 0) {
      player.knockbackLiftTween = this.scene.tweens.add({
        targets: player.sprite,
        y: startY - lift,
        duration: Math.max(80, Math.floor(durationMs * 0.45)),
        yoyo: true,
        ease: 'Sine.easeOut',
        onUpdate: () => this.updatePlayerAfterKnockback(),
        onComplete: () => {
          player.sprite.y = startY;
          player.knockbackLiftTween = null;
          this.updatePlayerAfterKnockback();
          this.finishPlayerKnockback();
        }
      });
    }

    this.scene.recordRunEvent('PLAYER_KNOCKBACK_STARTED', {
      direction: normalizedDirection > 0 ? 'right' : 'left',
      distance: Math.round(Math.abs(targetX - startX)),
      lift,
      durationMs,
      reason: options.reason || null
    });
  }

  updatePlayerAfterKnockback() {
    const player = this.scene.player;
    if (player.label) {
      player.label.setPosition(player.sprite.x - 31, player.sprite.y + 66);
    }
    if (this.scene.visionCircle) {
      this.scene.visionCircle.setPosition(player.sprite.x, player.sprite.y);
    }
  }

  finishPlayerKnockback() {
    const player = this.scene.player;
    if (player.knockbackTween || player.knockbackLiftTween) {
      return;
    }

    if (player.currentMovementAction === 'KNOCKBACK') {
      player.currentMovementAction = null;
      player.movementActionUntil = -Infinity;
    }
    this.updatePlayerAfterKnockback();
  }

  applyDamageKnockback(source, damageType) {
    const spec = this.getDamageKnockbackSpec(source, damageType);
    if (!spec) {
      return;
    }

    const direction = this.getDamageKnockbackDirection(source, damageType);
    if (!direction) {
      return;
    }

    this.knockbackPlayerFromDirection(direction, spec.distance, {
      lift: spec.lift,
      durationMs: spec.durationMs,
      reason: damageType
    });
  }

  getDamageKnockbackSpec(source, damageType) {
    if (damageType === 'boss_charge') {
      return {
        distance: source.combat && source.combat.chargeKnockback ? source.combat.chargeKnockback : 92,
        lift: source.combat && source.combat.chargeKnockbackLift ? source.combat.chargeKnockbackLift : 42,
        durationMs: source.combat && source.combat.chargeKnockbackMs ? source.combat.chargeKnockbackMs : 360
      };
    }

    if (damageType === 'boss_normal') {
      return { distance: 48, lift: 0, durationMs: 220 };
    }

    if (damageType === 'boss_triple') {
      return { distance: 58, lift: 18, durationMs: 280 };
    }

    if (damageType === 'contact_bump') {
      return {
        distance: source.combat && source.combat.bodyCollisionKnockback ? source.combat.bodyCollisionKnockback : 64,
        lift: 18,
        durationMs: 220
      };
    }

    if (damageType === 'melee') {
      return { distance: 40, lift: 12, durationMs: 220 };
    }

    if (damageType === 'charge') {
      return { distance: 64, lift: 28, durationMs: 300 };
    }

    if (damageType === 'contact') {
      return { distance: 32, lift: 10, durationMs: 200 };
    }

    return null;
  }

  getDamageKnockbackDirection(source, damageType) {
    if (
      damageType === 'boss_charge' &&
      source &&
      source.combatState &&
      source.combatState.chargeDirection
    ) {
      return source.combatState.chargeDirection;
    }

    if (source && source.sprite) {
      return this.scene.player.sprite.x <= source.sprite.x ? -1 : 1;
    }

    return null;
  }

  applyBodyCollisionDamage(entity) {
    const now = this.scene.time.now;
    const cooldownMs = entity.combat && entity.combat.bodyCollisionCooldownMs
      ? entity.combat.bodyCollisionCooldownMs
      : 650;

    if (entity.lastBodyCollisionAt && now - entity.lastBodyCollisionAt < cooldownMs) {
      return;
    }

    entity.lastBodyCollisionAt = now;
    const damage = entity.combat && entity.combat.bodyCollisionDamage
      ? entity.combat.bodyCollisionDamage
      : 4;
    const didDamage = this.applyDamage(damage, entity, 'contact_bump');
    if (didDamage) {
      this.flashText('KNOCKBACK', this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#ffb347');
    }

    this.addCombatEvent('PLAYER_BODY_COLLISION', entity, {
      damage,
      push: didDamage,
      damageApplied: didDamage
    });
  }

  patrolEnemy(entity) {
    if (entity.combatState.patrolOriginX === undefined) {
      entity.combatState.patrolOriginX = entity.sprite.x;
      entity.combatState.patrolDirection = -1;
    }

    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 42) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const patrolRange = entity.combat.patrolRange || 80;
    const minX = Math.max(roomLeft, entity.combatState.patrolOriginX - patrolRange);
    const maxX = Math.min(roomRight, entity.combatState.patrolOriginX + patrolRange);
    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const speed = entity.combat.patrolSpeed || entity.combat.moveSpeed || 18;
    const direction = entity.combatState.patrolDirection || -1;

    entity.sprite.x += direction * speed * deltaSeconds;

    if (entity.sprite.x <= minX) {
      entity.sprite.x = minX;
      entity.combatState.patrolDirection = 1;
    } else if (entity.sprite.x >= maxX) {
      entity.sprite.x = maxX;
      entity.combatState.patrolDirection = -1;
    }

    this.updateMovingEntity(entity);
  }

  ensureCombatState(entity) {
    if (entity.combatState) {
      return;
    }

    entity.combatState = {
      phase: this.getInitialCombatPhase(entity),
      phaseStartedAt: this.scene.time.now
    };
    if (this.debugEnabled) {
      entity.combatDebug = this.createEnemyTimelineDebug(entity);
    }
    if (entity.combat.behavior === 'boss_floor1') {
      const direction = this.scene.player.sprite.x >= entity.sprite.x ? 1 : -1;
      entity.combatState.pendingChargeDirection = direction;
      entity.combatState.lastChargeSkillAt = this.scene.time.now;
      entity.combatState.lastBossSkillAt = this.scene.time.now;
      entity.combatState.normalsSinceLastSkill = 0;
      this.showBossChargePath(entity, direction);
      this.addCombatEvent('BOSS_CHARGE_WINDUP', entity, { attackType: 'boss_charge' });
    }
  }

  elapsed(entity) {
    return this.scene.time.now - entity.combatState.phaseStartedAt;
  }

  setPhase(entity, phase) {
    entity.combatState.phase = phase;
    entity.combatState.phaseStartedAt = this.scene.time.now;
  }

  getInitialCombatPhase(entity) {
    if (entity.combat.behavior === 'boss_floor1') {
      return 'boss_charge_windup';
    }

    if (entity.combat.attackType === 'melee') {
      return 'patrolling';
    }

    if (entity.combat.attackType === 'contact') {
      return entity.combat.behavior === 'static' ? 'static' : 'patrolling';
    }

    return 'idle';
  }

  createEnemyTimelineDebug(entity) {
    const vision = this.scene.add.circle(
      entity.sprite.x,
      entity.sprite.y,
      this.getCombatVisionRange(entity),
      0xff8a66,
      0.035
    ).setStrokeStyle(1, 0xff8a66, 0.28);
    const hpBg = this.scene.add.rectangle(entity.sprite.x, entity.sprite.y - 58, 58, 5, 0x111116, 0.9);
    const hpFill = this.scene.add.rectangle(entity.sprite.x - 29, entity.sprite.y - 58, 58, 5, 0xff6b6b, 0.95).setOrigin(0, 0.5);
    const text = this.scene.add.text(entity.sprite.x, entity.sprite.y - 52, '绌洪棽', {
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
    entity.combatDebug.vision.setRadius(this.getCombatVisionRange(entity));
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
    if (phase === 'boss_charge_windup') {
      return entity.combat.chargeWindupMs;
    }
    if (phase === 'boss_charging') {
      return 900;
    }
    if (phase === 'boss_stunned_a') {
      return entity.combat.stunOnWallMs;
    }
    if (phase === 'boss_normal_windup') {
      return entity.combat.normalWindupMs;
    }
    if (phase === 'boss_normal_attacking') {
      return entity.combat.normalAttackMs;
    }
    if (phase === 'boss_normal_cooldown') {
      return entity.combat.normalCooldownMs;
    }
    if (phase === 'boss_reposition') {
      return entity.combat.repositionMs || 650;
    }
    if (phase === 'boss_phase2_trigger') {
      return entity.combat.phase2TriggerMs;
    }
    if (phase.startsWith('boss_triple_hit_')) {
      return entity.combat.tripleHitAttackMs;
    }
    if (phase.startsWith('boss_triple_wait_')) {
      return entity.combat.tripleHitInterval;
    }
    if (phase === 'boss_stunned_b') {
      return entity.combat.stunAfterTripleMs;
    }
    if (phase === 'patrolling' || phase === 'chasing' || phase === 'static') {
      return entity.combat.idleMs || 500;
    }
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
      patrolling: 0x8f887b,
      chasing: 0xff9f43,
      static: 0x8f887b,
      idle: 0x8f887b,
      windup: 0xffd166,
      attacking: 0xff6b6b,
      cooldown: 0x69c0ff,
      boss_charge_windup: 0xffd166,
      boss_charging: 0xff4f5e,
      boss_stunned_a: 0x69c0ff,
      boss_normal_windup: 0xffd166,
      boss_normal_attacking: 0xff6b6b,
      boss_normal_cooldown: 0x69c0ff,
      boss_reposition: 0xff9f43,
      boss_phase2_trigger: 0xd6bcfa,
      boss_triple_hit_1: 0xff4f5e,
      boss_triple_hit_2: 0xff4f5e,
      boss_triple_hit_3: 0xff4f5e,
      boss_triple_wait_1: 0xff9f43,
      boss_triple_wait_2: 0xff9f43,
      boss_stunned_b: 0x69c0ff
    };
    return colors[phase] || 0x8f887b;
  }

  getPhaseLabel(phase) {
    const labels = {
      patrolling: '巡逻',
      chasing: '追击',
      static: '定点',
      idle: '空闲',
      windup: '前摇',
      attacking: '攻击中',
      cooldown: '冷却',
      boss_charge_windup: '冲锋前摇',
      boss_charging: '冲锋',
      boss_stunned_a: '撞墙眩晕',
      boss_normal_windup: '普攻前摇',
      boss_normal_attacking: '普攻',
      boss_normal_cooldown: '普攻冷却',
      boss_reposition: '撞墙回位',
      boss_phase2_trigger: '二阶段',
      boss_triple_hit_1: '三连击 1',
      boss_triple_hit_2: '三连击 2',
      boss_triple_hit_3: '三连击 3',
      boss_triple_wait_1: '连击间隔',
      boss_triple_wait_2: '连击间隔',
      boss_stunned_b: '连击硬直'
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
      patrolling: '#8f887b',
      chasing: '#ff9f43',
      static: '#8f887b',
      idle: '#8f887b',
      windup: '#ffd166',
      attacking: '#ff6b6b',
      cooldown: '#69c0ff',
      boss_charge_windup: '#ffd166',
      boss_charging: '#ff4f5e',
      boss_stunned_a: '#69c0ff',
      boss_normal_windup: '#ffd166',
      boss_normal_attacking: '#ff6b6b',
      boss_normal_cooldown: '#69c0ff',
      boss_reposition: '#ff9f43',
      boss_phase2_trigger: '#d6bcfa',
      boss_triple_hit_1: '#ff4f5e',
      boss_triple_hit_2: '#ff4f5e',
      boss_triple_hit_3: '#ff4f5e',
      boss_triple_wait_1: '#ff9f43',
      boss_triple_wait_2: '#ff9f43',
      boss_stunned_b: '#69c0ff'
    };
    return colors[phase] || '#8f887b';
  }

  getCombatVisionRange(entity) {
    if (entity.combat.attackType === 'boss') {
      return Math.max(entity.combat.normalAttackRange || 0, 240);
    }

    if (entity.combat.attackType === 'melee') {
      return entity.combat.aggroRange || entity.combat.range || 0;
    }

    return entity.combat.range || 0;
  }

  performAttack(entity) {
    if (entity.combat.attackType === 'ranged') {
      this.spawnProjectile(entity);
      return;
    }

    if (entity.combat.attackType === 'charge') {
      this.performChargeAttack(entity);
      return;
    }

    this.performMeleeAttack(entity);
  }

  performChargeAttack(entity) {
    if (entity.isCharging) {
      return;
    }

    const direction = this.scene.player.sprite.x >= entity.sprite.x ? 1 : -1;
    const startX = entity.sprite.x;
    const targetX = startX + direction * (entity.combat.chargeDistance || 120);
    const duration = entity.combat.chargeDurationMs || 220;
    const didHitAtStart = this.isChargeHittingPlayer(entity, targetX);

    entity.isCharging = true;
    this.showChargePath(entity, targetX, didHitAtStart);
    this.scene.tweens.add({
      targets: entity.sprite,
      x: targetX,
      duration,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        this.updateMovingEntity(entity);
      },
      onComplete: () => {
        entity.sprite.x = targetX;
        entity.isCharging = false;
        this.updateMovingEntity(entity);
        this.resolveChargeHit(entity);
      }
    });
  }

  isChargeHittingPlayer(entity, targetX) {
    const minX = Math.min(entity.sprite.x, targetX) - entity.sprite.width / 2;
    const maxX = Math.max(entity.sprite.x, targetX) + entity.sprite.width / 2;
    const bounds = this.getPlayerHitBounds();
    const verticalGap = Math.abs(this.scene.player.sprite.y - entity.sprite.y);
    return bounds.right >= minX &&
      bounds.left <= maxX &&
      verticalGap <= (entity.combat.hitRange || 70);
  }

  resolveChargeHit(entity) {
    const distance = Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      entity.sprite.x,
      entity.sprite.y
    );
    const didHit = distance <= (entity.combat.hitRange || 70);
    this.showMeleeHitZone(entity, didHit, distance);

    if (!didHit) {
      this.flashText('钀界┖', entity.sprite.x, entity.sprite.y - 42, '#8f887b');
      this.addCombatEvent('ENEMY_ATTACK_MISSED', entity, {
        reason: 'out_of_range',
        attackType: 'charge',
        distance: Math.ceil(distance),
        hitRange: entity.combat.hitRange
      });
      return;
    }

    this.applyDamage(entity.combat.damage, entity, 'charge');
  }

  updateMovingEntity(entity) {
    if (entity.label) {
      entity.label.setPosition(entity.sprite.x - 28, entity.sprite.y + 60);
    }

    if (entity.visuals) {
      entity.visuals.forEach((visual) => {
        if (visual._entityOffset) {
          visual.setPosition(entity.sprite.x + visual._entityOffset.x, entity.sprite.y + visual._entityOffset.y);
        }
      });
    }

    if (entity.combatDebug) {
      this.updateEnemyTimelineDebug(entity);
    }
  }

  applyHitReaction(entity, source) {
    if (!entity.active || !entity.combat || !entity.combat.knockbackOnHit) {
      return;
    }

    const roomFrame = this.scene.mapSystem.floorData.roomFrame;
    const halfWidth = (entity.sprite.width || 42) / 2;
    const roomLeft = roomFrame.x - roomFrame.width / 2 + halfWidth;
    const roomRight = roomFrame.x + roomFrame.width / 2 - halfWidth;
    const direction = entity.sprite.x >= source.sprite.x ? 1 : -1;
    const distance = entity.combat.knockbackDistance || 70;
    const targetX = Phaser.Math.Clamp(entity.sprite.x + direction * distance, roomLeft, roomRight);

    if (entity.combatState) {
      entity.combatState.patrolOriginX = targetX;
      entity.combatState.patrolDirection = -direction;
    }

    this.scene.tweens.add({
      targets: entity.sprite,
      x: targetX,
      duration: 140,
      ease: 'Sine.easeOut',
      onUpdate: () => this.updateMovingEntity(entity),
      onComplete: () => this.updateMovingEntity(entity)
    });
    this.addCombatEvent('ENEMY_KNOCKBACK', entity, {
      distance: Math.round(Math.abs(targetX - entity.sprite.x)),
      attackType: entity.combat.attackType
    });
  }

  showChargePath(entity, targetX, didHit) {
    const color = didHit ? 0xff4f5e : 0xff9fbd;
    const width = Math.abs(targetX - entity.sprite.x);
    const x = (targetX + entity.sprite.x) / 2;
    const path = this.scene.add.rectangle(x, entity.sprite.y, width, entity.sprite.height + 18, color, didHit ? 0.18 : 0.1)
      .setStrokeStyle(1, color, didHit ? 0.6 : 0.35);
    path.setDepth(2);
    this.scene.tweens.add({
      targets: path,
      alpha: 0,
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => path.destroy()
    });
  }

  performMeleeAttack(entity) {
    this.facePlayer(entity);
    const distance = this.getPlayerEntityBoundsDistance(entity);
    const didHit = distance <= entity.combat.hitRange;
    this.showMeleeHitZone(entity, didHit, distance);

    if (!didHit) {
      this.flashText('钀界┖', entity.sprite.x, entity.sprite.y - 42, '#8f887b');
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
    const direction = entity.facing || (dx >= 0 ? 1 : -1);
    const slashWidth = Math.max(18, Math.min(distance, radius));
    const slashX = entity.sprite.x + direction * (slashWidth / 2);
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
    const direction = this.scene.player.facing || (target.sprite.x >= this.scene.player.sprite.x ? 1 : -1);
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

  spawnProjectile(entity, details = {}) {
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
      projectileId,
      ...details
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

  getEntityHitBounds(entity) {
    const bounds = entity.sprite.getBounds();
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height
    };
  }

  getPlayerEntityBoundsDistance(entity) {
    return this.getBoundsDistance(
      this.getPlayerHitBounds(),
      this.getEntityHitBounds(entity)
    );
  }

  getBoundsDistance(a, b) {
    const horizontalGap = Math.max(0, Math.max(b.left - a.right, a.left - b.right));
    const verticalGap = Math.max(0, Math.max(b.top - a.bottom, a.top - b.bottom));
    return Math.sqrt(horizontalGap * horizontalGap + verticalGap * verticalGap);
  }

  applyDamage(amount, source, damageType) {
    const now = this.scene.time.now;
    if (this.scene.player.dashInvulnerableUntil && now <= this.scene.player.dashInvulnerableUntil) {
      this.flashText('DASH', this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#69c0ff');
      this.addCombatEvent('PLAYER_DODGED', source, {
        damageType,
        reason: 'dash'
      });
      return false;
    }

    if (this.scene.player.damageInvulnerableUntil && now <= this.scene.player.damageInvulnerableUntil) {
      this.flashText('IFRAME', this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#99ffd8');
      this.addCombatEvent('PLAYER_DAMAGE_IMMUNED', source, {
        amount,
        damageType,
        reason: 'damage_iframe',
        hp: Math.ceil(this.scene.player.hp)
      });
      return false;
    }

    if (this.scene.player.isDefending && now > this.scene.player.defendingUntil) {
      this.scene.player.isDefending = false;
      this.scene.player.defendingUntil = -Infinity;
    }

    const finalAmount = this.scene.player.isDefending
      ? Math.ceil(amount * 0.5)
      : amount;
    this.scene.player.hp = Math.max(0, this.scene.player.hp - finalAmount);
    this.scene.player.damageInvulnerableUntil = now + 900;
    if (damageType === 'melee' || damageType === 'charge' || damageType === 'boss_charge' || damageType === 'boss_normal' || damageType === 'boss_triple' || damageType === 'contact_bump') {
      this.flashText(`-${finalAmount}`, this.scene.player.sprite.x, this.scene.player.sprite.y - 44, '#ff6b6b');
    }
    this.addCombatEvent('PLAYER_DAMAGED', source, {
      amount: finalAmount,
      baseAmount: amount,
      damageType,
      defended: Boolean(this.scene.player.isDefending),
      hp: Math.ceil(this.scene.player.hp)
    });
    this.applyDamageKnockback(source, damageType);
    return true;
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
    this.cancelResolvedThreatMovement(type);

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

    if (
      type === 'ENEMY_CHASING' ||
      type === 'ENEMY_WINDUP' ||
      type === 'ENEMY_COOLDOWN' ||
      type === 'BOSS_CHARGE_WINDUP' ||
      type === 'BOSS_NORMAL_WINDUP' ||
      type === 'BOSS_NORMAL_COOLDOWN' ||
      type === 'BOSS_TRIPLE_HIT' ||
      type === 'BOSS_STUNNED_A' ||
      type === 'BOSS_STUNNED_B' ||
      type === 'PROJECTILE_SPAWNED'
    ) {
      this.pendingThreatEvents.push(event);
    }

    this.scene.recordRunEvent(type, {
      sourceId: source.id,
      sourceType: source.type,
      ...details
    });
    this.scene.addLog(`Combat: ${type} ${source.type}`);
  }

  cancelResolvedThreatMovement(type) {
    if (!this.scene.movementSystem) {
      return;
    }

    const resolvedThreatsByEvent = {
      BOSS_NORMAL_ATTACKING: ['BOSS_NORMAL_WINDUP'],
      BOSS_NORMAL_COOLDOWN: ['BOSS_NORMAL_WINDUP'],
      BOSS_CHARGE_HIT: ['BOSS_CHARGE_WINDUP'],
      BOSS_STUNNED_A: ['BOSS_CHARGE_WINDUP'],
      BOSS_STUNNED_B: ['BOSS_TRIPLE_HIT']
    };
    const threatTypes = resolvedThreatsByEvent[type];
    if (!threatTypes) {
      return;
    }

    this.scene.movementSystem.cancelThreatMove(threatTypes, 'threat_resolved');
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
          (entity.combatState.phase === 'windup' ||
            entity.combatState.phase === 'attacking' ||
            entity.combatState.phase.includes('windup') ||
            entity.combatState.phase.includes('attacking') ||
            entity.combatState.phase.startsWith('boss_triple_hit_'));
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
          timeToAttackMs: phase === 'windup' || phase.includes('windup') ? Math.ceil(remainingMs) : 0,
          damage: entity.combat.damage || entity.combat.normalAttackDamage || entity.combat.tripleHitDamage || 0,
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

      if (!this.isThreatObservable(event)) {
        event.visibleAt = null;
        return null;
      }

      if (event.visibleAt === undefined || event.visibleAt === null) {
        event.visibleAt = this.scene.time.now;
      }

      if (!this.isThreatReady(event, config)) {
        return null;
      }

      if (this.scene.time.now - event.visibleAt < this.getThreatReactionDelay(event, config)) {
        return null;
      }

      if (!this.canRespondToThreat(event, config)) {
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

  isThreatObservable(event) {
    if (event.type === 'PROJECTILE_SPAWNED') {
      const projectile = this.findProjectileByThreatEvent(event);
      return Boolean(
        projectile &&
        projectile.sprite &&
        Phaser.Math.Distance.Between(
          this.scene.player.sprite.x,
          this.scene.player.sprite.y,
          projectile.sprite.x,
          projectile.sprite.y
        ) <= this.scene.visionRadius
      );
    }

    const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
    return Boolean(
      source &&
      source.active &&
      source.sprite &&
      StateSnapshot.isInVision(this.scene.player, source, this.scene.visionRadius)
    );
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
      responseDelayMs: this.getThreatReactionDelay(event, config),
      responseElapsedMs: event.visibleAt ? Math.round(this.scene.time.now - event.visibleAt) : 0
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

  canRespondToThreat(event, config) {
    const rule = StrategyConfig.getCombatRule(config, event.sourceType, event.type);
    if (!rule || rule.responseAction !== 'jump') {
      return true;
    }

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

    if (event.type === 'ENEMY_CHASING') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        source.combatState.phase === 'chasing'
      );
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

    if (event.type === 'BOSS_CHARGE_WINDUP') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        (source.combatState.phase === 'boss_charge_windup' || source.combatState.phase === 'boss_charging')
      );
    }

    if (event.type === 'BOSS_NORMAL_WINDUP') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        (source.combatState.phase === 'boss_normal_windup' || source.combatState.phase === 'boss_normal_attacking')
      );
    }

    if (event.type === 'BOSS_NORMAL_COOLDOWN') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        source.combatState.phase === 'boss_normal_cooldown'
      );
    }

    if (event.type === 'BOSS_TRIPLE_HIT') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        source.combatState.phase.startsWith('boss_triple_hit_')
      );
    }

    if (event.type === 'BOSS_STUNNED_A' || event.type === 'BOSS_STUNNED_B') {
      const source = this.scene.entities.find((entity) => entity.id === event.sourceId);
      const expectedPhase = event.type === 'BOSS_STUNNED_A' ? 'boss_stunned_a' : 'boss_stunned_b';
      return Boolean(
        source &&
        source.active &&
        source.combatState &&
        source.combatState.phase === expectedPhase
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

