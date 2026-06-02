class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.roomExitX = 855;

    this.scene.isRetreating = false;
    this.scene.retreatTarget = null;
  }

  autoAdvance() {
    if (
      this.scene.isRetreating ||
      this.scene.isEncounterLocked ||
      this.scene.isRunComplete ||
      this.scene.player.isBackstepping ||
      this.scene.player.combatHoldSourceId
    ) {
      return;
    }

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
    if (options.combatBackstep) {
      this.backstepFromThreat(options.sourceId);
      return;
    }

    const step = 36;
    const offsets = {
      left: [-step, 0],
      right: [step, 0]
    };
    const offset = offsets[direction];

    if (!offset) {
      this.scene.addLog(`MOVE ignored: bad direction ${direction}`);
      return;
    }

    this.scene.player.sprite.x += offset[0];
    this.scene.player.sprite.y += offset[1];
    this.updateEntityLabels();
    this.scene.addLog(`MOVE applied: ${direction}`);
  }

  backstepFromThreat(sourceId) {
    if (this.scene.player.isBackstepping) {
      this.scene.addLog('BACKSTEP ignored: already moving');
      return;
    }

    const distance = 72;
    const duration = 320;
    const startX = this.scene.player.sprite.x;
    const targetX = Math.max(80, startX - distance);

    this.scene.player.isBackstepping = true;
    this.scene.player.combatHoldSourceId = sourceId || null;
    this.scene.isEncounterLocked = true;
    this.scene.addLog(`BACKSTEP started: ${sourceId || 'unknown'}`);

    this.scene.tweens.add({
      targets: this.scene.player.sprite,
      x: targetX,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.updateEntityLabels();
      },
      onComplete: () => {
        this.scene.player.sprite.x = targetX;
        this.scene.player.isBackstepping = false;
        this.updateEntityLabels();
        this.scene.addLog('BACKSTEP ended: waiting for attack window');
      }
    });
  }

  updateCombatHold() {
    const sourceId = this.scene.player.combatHoldSourceId;
    if (!sourceId) {
      return;
    }

    const source = this.scene.entities.find((entity) => entity.id === sourceId && entity.active);
    if (!source || !source.combatState) {
      this.clearCombatHold();
      return;
    }

    if (source.combatState.phase === 'cooldown') {
      this.clearCombatHold();
      this.scene.addLog(`BACKSTEP hold released: ${sourceId} cooling down`);
    }
  }

  clearCombatHold() {
    this.scene.player.combatHoldSourceId = null;
    this.scene.isEncounterLocked = this.scene.eventSystem ? this.scene.eventSystem.hasBlockingEncounter() : false;
  }

  jumpPlayer() {
    if (this.scene.player.isJumping) {
      this.scene.addLog('JUMP ignored: already jumping');
      return false;
    }

    const startY = this.scene.player.sprite.y;
    const jumpHeight = 117;
    this.scene.player.isJumping = true;
    this.scene.player.groundY = startY;
    this.scene.player.jumpStartedAt = this.scene.time.now;
    this.scene.player.sprite.setFillStyle(0xb6e3ff);
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
    const summary = this.scene.createRunSummary('retreat');
    this.scene.showStatus('RETREAT resolved: returned safely with current bag');
    this.scene.addLog('RETREAT resolved: safe return');
    this.scene.time.delayedCall(650, () => {
      this.scene.scene.start('ReturnScene', summary);
    });
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
}

globalThis.MovementSystem = MovementSystem;
