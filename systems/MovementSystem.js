class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.roomExitX = 855;

    this.scene.isRetreating = false;
    this.scene.retreatTarget = null;
  }

  autoAdvance() {
    const now = this.scene.time.now;
    if (
      this.scene.isRetreating ||
      this.scene.isEncounterLocked ||
      this.scene.isRunComplete ||
      this.scene.player.manualMove ||
      now < this.scene.player.manualMoveGraceUntil
    ) {
      return;
    }

    if (this.updatePlayerCombatEngagement()) {
      this.updateEntityLabels();
      return;
    }

    this.scene.player.facing = 1;
    this.scene.player.sprite.x += this.scene.autoAdvanceSpeed * (this.scene.game.loop.delta / 1000);
    if (this.scene.player.sprite.x >= this.roomExitX) {
      this.scene.player.sprite.x = this.roomExitX;
      if (this.scene.mapSystem.loadNextRoom()) {
        this.scene.showStatus(`Entered ${this.scene.currentRoomId}`);
        this.updateEntityLabels();
        return;
      }

      this.scene.isRunComplete = true;
      this.scene.showStatus('Floor complete: no more rooms in this slice');
      this.scene.addLog('Floor complete');
    }
    this.updateEntityLabels();
  }

  movePlayer(direction, options = {}) {
    const vector = this.getDirectionVector(direction);
    if (!vector) {
      this.scene.addLog(`MOVE ignored: bad direction ${direction}`);
      this.recordMoveIgnored('MOVE', 'bad_direction', { direction });
      return false;
    }

    const durationMs = this.getMoveDuration(options.durationMs);
    const now = this.scene.time.now;
    const wasMoving = Boolean(this.scene.player.manualMove);
    this.scene.player.manualMove = {
      direction,
      vector,
      startedAt: now,
      endsAt: now + durationMs,
      interruptOnVisibleEnemy: Boolean(options.interruptOnVisibleEnemy),
      sourceEventType: options.sourceEventType || null,
      targetId: options.targetId || null,
      stopAtAttackRange: Boolean(options.stopAtAttackRange),
      threatType: options.threatType || null
    };
    this.scene.player.facing = vector.x < 0 ? -1 : vector.x > 0 ? 1 : this.scene.player.facing;
    this.startMovementAction('MOVE', durationMs);
    this.scene.addLog(`${wasMoving ? 'MOVE refreshed' : 'MOVE started'}: ${direction}`);
    this.scene.recordRunEvent(wasMoving ? 'PLAYER_MOVE_REFRESHED' : 'PLAYER_MOVE_STARTED', {
      action: 'MOVE',
      direction,
      durationMs,
      x: Math.round(this.scene.player.sprite.x),
      y: Math.round(this.scene.player.sprite.y)
    });
    return true;
  }

  getMoveDuration(durationMs) {
    if (durationMs === undefined || durationMs === null) {
      return 420;
    }

    return Phaser.Math.Clamp(
      Math.round(Number(durationMs) || 420),
      100,
      1500
    );
  }

  updateManualMove() {
    const manualMove = this.scene.player.manualMove;
    if (!manualMove || this.scene.isRunComplete || this.scene.isRetreating) {
      return;
    }

    const now = this.scene.time.now;
    const isCombatEngaged = this.updatePlayerCombatEngagement();
    if (manualMove.interruptOnVisibleEnemy && isCombatEngaged) {
      this.finishManualMove('visible_enemy');
      return;
    }

    if (this.shouldStopAtAttackRange(manualMove)) {
      this.finishManualMove('attack_range_reached');
      return;
    }

    const deltaSeconds = this.scene.game.loop.delta / 1000;
    const speed = this.scene.autoAdvanceSpeed;
    const dx = manualMove.vector.x * speed * deltaSeconds;
    const dy = this.getVerticalStep(manualMove.vector.y, speed * deltaSeconds);

    if (dx !== 0) {
      this.scene.player.facing = dx < 0 ? -1 : 1;
    }

    const nextX = Phaser.Math.Clamp(
      this.scene.player.sprite.x + dx,
      80,
      this.roomExitX
    );
    this.scene.player.sprite.x = this.resolvePlayerEnemyBlocking(nextX);
    this.scene.player.sprite.y += dy;
    this.updateEntityLabels();

    if (this.shouldStopAtAttackRange(manualMove)) {
      this.finishManualMove('attack_range_reached');
      return;
    }

    if (now >= manualMove.endsAt) {
      this.finishManualMove('completed');
    }
  }

  getDirectionVector(direction) {
    const vectors = {
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left_up: { x: -1, y: -1 },
      right_up: { x: 1, y: -1 },
      left_down: { x: -1, y: 1 },
      right_down: { x: 1, y: 1 }
    };
    return vectors[direction] || null;
  }

  getVerticalStep(y, step) {
    return this.scene.allowVerticalMove ? y * step : 0;
  }

  resolvePlayerEnemyBlocking(nextX) {
    const player = this.scene.player;
    const currentX = player.sprite.x;
    if (nextX === currentX) {
      return nextX;
    }

    const direction = nextX > currentX ? 1 : -1;
    const playerHalfWidth = (player.sprite.width || 42) / 2;
    const blockingEnemy = this.scene.entities.find((entity) => {
      if (!entity.active || entity.kind !== 'enemy' || !entity.sprite) {
        return false;
      }

      const verticalGap = Math.abs(entity.sprite.y - player.sprite.y);
      const combinedHalfHeight = ((entity.sprite.height || 42) + (player.sprite.height || 42)) / 2;
      if (verticalGap >= combinedHalfHeight) {
        return false;
      }

      const entityHalfWidth = (entity.sprite.width || 42) / 2;
      if (direction > 0) {
        const playerRightNow = currentX + playerHalfWidth;
        const playerRightNext = nextX + playerHalfWidth;
        return playerRightNow <= entity.sprite.x - entityHalfWidth &&
          playerRightNext > entity.sprite.x - entityHalfWidth;
      }

      const playerLeftNow = currentX - playerHalfWidth;
      const playerLeftNext = nextX - playerHalfWidth;
      return playerLeftNow >= entity.sprite.x + entityHalfWidth &&
        playerLeftNext < entity.sprite.x + entityHalfWidth;
    });

    if (!blockingEnemy) {
      return nextX;
    }

    const entityHalfWidth = (blockingEnemy.sprite.width || 42) / 2;
    const stopGap = 2;
    return direction > 0
      ? blockingEnemy.sprite.x - entityHalfWidth - playerHalfWidth - stopGap
      : blockingEnemy.sprite.x + entityHalfWidth + playerHalfWidth + stopGap;
  }

  shouldStopAtAttackRange(manualMove) {
    if (!manualMove.stopAtAttackRange || !manualMove.targetId || !this.scene.combatSystem) {
      return false;
    }

    const target = this.scene.entities.find((entity) => {
      return entity.id === manualMove.targetId && entity.active && entity.kind === 'enemy';
    });
    if (!target) {
      return false;
    }

    return this.scene.combatSystem.getPlayerEntityBoundsDistance(target) <= this.scene.player.attackRange;
  }

  hasVisibleEnemy() {
    return this.scene.entities.some((entity) => {
      return entity.active &&
        entity.kind === 'enemy' &&
        entity.sprite &&
        StateSnapshot.isInVision(this.scene.player, entity, this.scene.visionRadius);
    });
  }

  hasActiveEnemy() {
    return this.scene.entities.some((entity) => {
      return entity.active && entity.kind === 'enemy';
    });
  }

  updatePlayerCombatEngagement() {
    if (this.hasVisibleEnemy()) {
      this.enterPlayerCombat();
      return true;
    }

    if (!this.scene.isPlayerCombatEngaged) {
      return false;
    }

    if (this.hasActiveEnemy()) {
      return true;
    }

    this.exitPlayerCombat();
    return false;
  }

  enterPlayerCombat() {
    if (this.scene.isPlayerCombatEngaged) {
      return;
    }

    this.scene.isPlayerCombatEngaged = true;
    this.scene.recordRunEvent('PLAYER_COMBAT_ENTERED', {
      reason: 'visible_enemy'
    });
  }

  exitPlayerCombat() {
    if (!this.scene.isPlayerCombatEngaged) {
      return;
    }

    this.scene.isPlayerCombatEngaged = false;
    this.scene.recordRunEvent('PLAYER_COMBAT_EXITED', {
      reason: 'no_active_enemy'
    });
  }

  jumpPlayer() {
    if (this.scene.player.isJumping) {
      this.scene.addLog('JUMP ignored: already jumping');
      return false;
    }

    const startY = this.scene.player.sprite.y;
    const jumpHeight = 117;
    this.scene.player.isJumping = true;
    this.scene.player.doubleJumpUsed = false;
    this.scene.player.groundY = startY;
    this.scene.player.jumpStartedAt = this.scene.time.now;
    this.scene.player.sprite.setFillStyle(0xb6e3ff);
    this.startMovementAction('JUMP', 820);
    this.scene.addLog('JUMP started');
    this.scene.tweens.add({
      targets: this.scene.player.sprite,
      y: startY - jumpHeight,
      duration: 360,
      yoyo: true,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.updateEntityLabels();
      },
      onComplete: () => {
        this.scene.player.sprite.y = startY;
        this.updateEntityLabels();
      }
    });

    this.scene.time.delayedCall(820, () => {
      this.scene.player.isJumping = false;
      this.scene.player.sprite.setFillStyle(0x78c2ff);
      this.scene.addLog('JUMP ended');
    });

    return true;
  }

  doubleJumpPlayer() {
    if (!this.scene.player.isJumping) {
      this.scene.addLog('DOUBLE_JUMP ignored: not jumping');
      return false;
    }

    if (this.scene.player.doubleJumpUsed) {
      this.scene.addLog('DOUBLE_JUMP ignored: already used');
      return false;
    }

    this.scene.player.doubleJumpUsed = true;
    this.scene.player.sprite.y -= 42;
    this.startMovementAction('DOUBLE_JUMP', 220);
    this.updateEntityLabels();
    this.scene.addLog('DOUBLE_JUMP applied');
    return true;
  }

  dashPlayer(direction = 'right') {
    const now = this.scene.time.now;
    const cooldownRemaining = this.scene.player.dashCooldownMs - (now - this.scene.player.lastDashAt);
    if (cooldownRemaining > 0) {
      this.scene.addLog(`DASH ignored: cooldown ${Math.ceil(cooldownRemaining)}ms`);
      return false;
    }

    const vector = this.getDirectionVector(direction);
    if (!vector) {
      this.scene.addLog(`DASH ignored: bad direction ${direction}`);
      return false;
    }

    const distance = 130;
    const startX = this.scene.player.sprite.x;
    const startY = this.scene.player.sprite.y;
    const targetX = Phaser.Math.Clamp(startX + vector.x * distance, 80, this.roomExitX);
    const targetY = startY + this.getVerticalStep(vector.y, distance);

    this.scene.player.lastDashAt = now;
    this.scene.player.isDashing = true;
    this.scene.player.dashInvulnerableUntil = now + 1500;
    this.scene.player.facing = vector.x < 0 ? -1 : vector.x > 0 ? 1 : this.scene.player.facing;
    this.scene.player.sprite.setFillStyle(0xd2f7ff);
    this.startMovementAction('DASH', 180);
    this.scene.addLog(`DASH started: ${direction}`);
    this.scene.tweens.add({
      targets: this.scene.player.sprite,
      x: targetX,
      y: targetY,
      duration: 180,
      ease: 'Sine.easeOut',
      onUpdate: () => this.updateEntityLabels(),
      onComplete: () => {
        this.scene.player.isDashing = false;
        if (!this.scene.player.isJumping) {
          this.scene.player.sprite.setFillStyle(0x78c2ff);
        }
        this.updateEntityLabels();
        this.scene.addLog('DASH ended');
      }
    });
    this.scene.time.delayedCall(1500, () => {
      if (!this.scene.player.isJumping && !this.scene.player.isDashing) {
        this.scene.player.sprite.setFillStyle(0x78c2ff);
      }
    });
    return true;
  }

  startRetreat() {
    const returnPoint = this.scene.entities.find((entity) => {
      return entity.active && entity.kind === 'return_point';
    });

    if (!returnPoint) {
      this.scene.addLog('RETREAT failed: no return point known');
      return;
    }

    this.scene.isRetreating = true;
    this.scene.isEncounterLocked = false;
    this.scene.retreatTarget = returnPoint;
    this.scene.player.currentMovementAction = 'RETREAT';
    this.scene.player.movementActionUntil = Infinity;
    this.scene.showStatus('RETREAT started: moving to return point');
    this.scene.addLog('RETREAT started');
  }

  updateRetreat() {
    if (!this.scene.isRetreating || !this.scene.retreatTarget || this.scene.isRunComplete) {
      return;
    }

    const target = this.scene.retreatTarget.sprite;
    const dx = target.x - this.scene.player.sprite.x;
    const dy = target.y - this.scene.player.sprite.y;
    const distance = Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      target.x,
      target.y
    );

    if (distance <= 8) {
      this.scene.player.sprite.x = target.x;
      this.scene.player.sprite.y = target.y;
      this.updateEntityLabels();
      this.completeRetreat();
      return;
    }

    const step = this.scene.autoAdvanceSpeed * 1.35 * (this.scene.game.loop.delta / 1000);
    this.scene.player.sprite.x += (dx / distance) * step;
    this.scene.player.sprite.y += (dy / distance) * step;
    this.updateEntityLabels();
  }

  completeRetreat() {
    this.scene.isRetreating = false;
    this.scene.isRunComplete = true;
    this.clearMovementAction('RETREAT');
    const summary = this.scene.createRunSummary('retreat');
    this.scene.showStatus('RETREAT resolved: returned safely with current bag');
    this.scene.addLog('RETREAT resolved: safe return');
    this.scene.time.delayedCall(650, () => {
      this.scene.scene.start('ReturnScene', summary);
    });
  }

  finishManualMove(reason) {
    const manualMove = this.scene.player.manualMove;
    if (!manualMove) {
      return;
    }

    this.scene.player.manualMove = null;
    this.scene.player.manualMoveGraceUntil = this.scene.time.now + 240;
    this.clearMovementAction('MOVE');
    this.scene.addLog(`MOVE ended: ${manualMove.direction}`);
    this.scene.recordRunEvent('PLAYER_MOVE_ENDED', {
      action: 'MOVE',
      direction: manualMove.direction,
      reason,
      x: Math.round(this.scene.player.sprite.x),
      y: Math.round(this.scene.player.sprite.y)
    });
  }

  cancelThreatMove(threatTypes, reason = 'threat_resolved') {
    const manualMove = this.scene.player.manualMove;
    if (!manualMove || manualMove.sourceEventType !== 'STATE_COMBAT_THREAT') {
      return false;
    }

    const threatSet = new Set(Array.isArray(threatTypes) ? threatTypes : [threatTypes]);
    if (!threatSet.has(manualMove.threatType)) {
      return false;
    }

    this.finishManualMove(reason);
    return true;
  }

  updateEntityLabels() {
    if (this.scene.visionCircle) {
      this.scene.visionCircle.setPosition(this.scene.player.sprite.x, this.scene.player.sprite.y);
    }

    if (this.scene.player.label) {
      this.scene.player.label.setPosition(this.scene.player.sprite.x - 20, this.scene.player.sprite.y + 66);
    }

    this.scene.entities.forEach((entity) => {
      if (!entity.label || !entity.sprite || !entity.active) {
        return;
      }

      entity.label.setPosition(entity.sprite.x - 28, entity.sprite.y + 60);
    });
  }

  startMovementAction(action, durationMs) {
    const until = this.scene.time.now + durationMs;
    this.scene.player.currentMovementAction = action;
    this.scene.player.movementActionUntil = until;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.scene.player.movementActionUntil <= until) {
        this.clearMovementAction(action);
      }
    });
  }

  recordMoveIgnored(action, reason, details = {}) {
    this.scene.recordRunEvent('PLAYER_MOVE_IGNORED', {
      action,
      reason,
      ...details
    });
  }

  clearMovementAction(action = null) {
    if (action && this.scene.player.currentMovementAction !== action) {
      return;
    }

    this.scene.player.currentMovementAction = null;
    this.scene.player.movementActionUntil = -Infinity;
  }
}

globalThis.MovementSystem = MovementSystem;
