class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  create() {
    this.currentFloor = 1;
    this.currentRoomId = 'room_001';
    this.returnPointKnown = false;
    this.returnPointDistance = 'far';
    this.visionRadius = 170;
    this.encounterRadius = 120;
    this.autoAdvanceSpeed = 100;
    this.isEncounterLocked = false;
    this.isPlayerCombatEngaged = false;
    this.isRunComplete = false;
    this.pendingNewRoomEvent = false;
    this.strategyConfig = window.hellSurvivalStrategyConfig || StrategyConfig.load();
    this.newCodexEntries = [];
    this.entities = [];

    this.mapSystem = new MapSystem(this);
    this.mapSystem.createRoom();
    this.createPlayer();
    this.createSystems();
    this.createVisionCircle();
    this.mapSystem.loadRoom(this.currentRoomId);
    this.updateEntityLabels();
    this.createLabels();
    this.addLog('Dungeon ready');
  }

  update() {
    this.applyHazardDamage();
    this.combatSystem.update();
    this.updateHud();
    this.checkDeath();
    this.updateRetreat();
    this.updateManualMove();
    this.autoAdvance();
    this.eventSystem.update();
  }

  createPlayer() {
    const data = PlayerData;
    const sprite = this.add.rectangle(180, 270, data.width, data.height, data.fillColor);
    this.player = {
      id: data.id,
      sprite,
      label: this.add.text(sprite.x - 20, sprite.y + 66, data.label.text, {
        fontSize: '14px',
        color: data.label.color
      }),
      hp: data.hp,
      maxHp: data.maxHp,
      mp: data.mp,
      maxMp: data.maxMp,
      attackDamage: data.attackDamage,
      attackRange: data.attackRange,
      attackCooldownMs: data.attackCooldownMs,
      lastAttackAt: -Infinity,
      facing: 1,
      currentTargetId: null,
      manualMove: null,
      manualMoveGraceUntil: -Infinity,
      currentMovementAction: null,
      movementActionUntil: -Infinity,
      currentAttackAction: null,
      attackActionUntil: -Infinity,
      isAttacking: false,
      isDashing: false,
      lastDashAt: -Infinity,
      dashCooldownMs: 5000,
      dashInvulnerableUntil: -Infinity,
      damageInvulnerableUntil: -Infinity,
      isDefending: false,
      defendingUntil: -Infinity,
      isInvincible: false,
      invincibleStoredHp: null,
      invincibleStoredMaxHp: null,
      doubleJumpUsed: false,
      gold: data.gold,
      buffs: data.buffs.map((buff) => ({ ...buff })),
      bag: {
        slots: data.bag.slots,
        used: data.bag.used,
        items: data.bag.items.map((item) => ({ ...item }))
      }
    };
  }

  createVisionCircle() {
    this.visionCircle = this.add.circle(
      this.player.sprite.x,
      this.player.sprite.y,
      this.visionRadius,
      0x78c2ff,
      0.06
    );
    this.visionCircle.setStrokeStyle(2, 0x78c2ff, 0.28);
    this.visionCircle.setDepth(1);
    this.player.sprite.setDepth(2);
    this.player.label.setDepth(3);
  }

  createSystems() {
    this.combatSystem = new CombatSystem(this);
    this.inventorySystem = new InventorySystem(this.player.bag);
    this.hazardSystem = new HazardSystem(this);
    this.lootSystem = new LootSystem(this);
    this.movementSystem = new MovementSystem(this);
    this.runRecorder = new RunRecorder(this);
    this.recordRunEvent('RUN_CODE_VERSION', {
      codeVersion: window.HELL_SURVIVAL_CODE_VERSION || null
    });
    this.settlementSystem = new SettlementSystem(this);
    this.agentRunner = new AgentRunner();
    this.commandExecutor = new CommandExecutor(this);
    this.eventSystem = new EventSystem(this, this.agentRunner, this.commandExecutor);
  }

  unlockCodexForEntity(entity) {
    if (!entity || entity.kind !== 'enemy') {
      return;
    }

    const unlocked = ProgressSystem.unlockCodex(entity.type);
    if (!unlocked) {
      return;
    }

    this.newCodexEntries.push({
      type: entity.type
    });
    this.addLog(`Codex unlocked: ${entity.type}`);
  }

  recordRunEvent(type, details = {}) {
    this.runRecorder.record(type, details);
    if (details.sourceType) {
      ProgressSystem.recordObservedEvent(details.sourceType, type, details);
    }
  }

  hasActiveBoss() {
    return this.entities.some((entity) => {
      return entity.active && entity.kind === 'enemy' && entity.type === 'boss_floor1';
    });
  }

  unlockBossReturnPoint() {
    const returnPoint = this.entities.find((entity) => {
      return entity.kind === 'return_point' && entity.lockedUntilBossDefeated;
    });

    if (!returnPoint || returnPoint.active) {
      return;
    }

    returnPoint.active = true;
    this.mapSystem.setEntityVisible(returnPoint, true);
    this.returnPointKnown = false;
    this.returnPointDistance = 'far';
    this.recordRunEvent('BOSS_RETURN_POINT_UNLOCKED', {
      entityId: returnPoint.id
    });
    this.showStatus('Boss defeated: return point appeared');
    this.addLog(`Boss return point unlocked: ${returnPoint.id}`);
  }

  createLabels() {
    this.hud = new HUD(this);
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
    this.input.keyboard.on('keydown-N', () => {
      this.skipToNextRoom();
    });
    this.input.keyboard.on('keydown-B', () => {
      this.skipToBossRoom();
    });
    this.input.keyboard.on('keydown-P', () => {
      this.forceBossPhase2();
    });
    this.input.keyboard.on('keydown-I', () => {
      this.toggleInvincible();
    });
  }

  toggleInvincible() {
    const willEnable = !this.player.isInvincible;
    if (willEnable) {
      this.player.invincibleStoredHp = this.player.hp;
      this.player.invincibleStoredMaxHp = this.player.maxHp;
      this.player.maxHp = 9999;
      this.player.hp = 9999;
      this.player.isInvincible = true;
    } else {
      this.player.isInvincible = false;
      if (Number.isFinite(this.player.invincibleStoredMaxHp)) {
        this.player.maxHp = this.player.invincibleStoredMaxHp;
      }
      if (Number.isFinite(this.player.invincibleStoredHp)) {
        this.player.hp = Phaser.Math.Clamp(this.player.invincibleStoredHp, 1, this.player.maxHp);
      }
      this.player.invincibleStoredHp = null;
      this.player.invincibleStoredMaxHp = null;
    }

    this.recordRunEvent('PLAYER_INVINCIBLE_TOGGLED', {
      enabled: this.player.isInvincible,
      hp: Math.ceil(this.player.hp),
      maxHp: this.player.maxHp
    });
    this.showStatus(`Invincible ${this.player.isInvincible ? 'ON' : 'OFF'}`);
    this.addLog(`Debug invincible: ${this.player.isInvincible ? 'ON' : 'OFF'}`);
    this.updateHud();
  }

  skipToNextRoom() {
    if (this.isRunComplete) {
      return;
    }

    this.isRetreating = false;
    this.retreatTarget = null;
    this.isEncounterLocked = false;

    if (!this.mapSystem.loadNextRoom()) {
      this.showStatus('Debug skip: no next room');
      this.addLog('Debug skip failed: no next room');
      return;
    }

    this.showStatus(`Debug skip: entered ${this.currentRoomId}`);
    this.addLog(`Debug skip: ${this.currentRoomId}`);
  }

  skipToBossRoom() {
    if (this.isRunComplete) {
      return;
    }

    const bossRoom = this.mapSystem.floorData.rooms.find((room) => {
      return room.entities.some((entity) => entity.kind === 'enemy' && entity.type === 'boss_floor1');
    });
    if (!bossRoom) {
      this.showStatus('Debug boss skip failed: no boss room');
      this.addLog('Debug boss skip failed');
      return;
    }

    this.isRetreating = false;
    this.retreatTarget = null;
    this.isEncounterLocked = false;
    this.pendingNewRoomEvent = true;
    this.mapSystem.loadRoom(bossRoom.id);
    this.mapSystem.movePlayerToRoomStart(bossRoom);
    this.showStatus(`Debug skip: entered ${bossRoom.id}`);
    this.addLog(`Debug boss skip: ${bossRoom.id}`);
  }

  forceBossPhase2() {
    const boss = this.entities.find((entity) => entity.active && entity.type === 'boss_floor1');
    if (!boss) {
      this.showStatus('Debug phase2 failed: no active boss');
      this.addLog('Debug phase2 failed: no active boss');
      return;
    }

    this.combatSystem.ensureCombatState(boss);
    const threshold = Math.floor(boss.maxHp * (boss.combat.phase2Threshold || 0.4));
    boss.hp = Math.max(1, threshold);
    if (!boss.combatState.phase2Started) {
      this.combatSystem.startBossPhase2(boss);
    }
    this.showStatus(`Debug phase2: Boss HP ${boss.hp}/${boss.maxHp}`);
    this.addLog(`Debug phase2: ${boss.id}`);
  }

  showStatus(message) {
    this.hud.showStatus(message);
  }

  autoAdvance() {
    this.movementSystem.autoAdvance();
  }

  movePlayer(direction, options) {
    return this.movementSystem.movePlayer(direction, options);
  }

  jumpPlayer() {
    return this.movementSystem.jumpPlayer();
  }

  doubleJumpPlayer() {
    return this.movementSystem.doubleJumpPlayer();
  }

  dashPlayer(direction) {
    return this.movementSystem.dashPlayer(direction);
  }

  updateManualMove() {
    this.movementSystem.updateManualMove();
  }

  startRetreat() {
    this.movementSystem.startRetreat();
  }

  updateRetreat() {
    this.movementSystem.updateRetreat();
  }

  completeRetreat() {
    this.movementSystem.completeRetreat();
  }

  updateEntityLabels() {
    this.movementSystem.updateEntityLabels();
  }

  addLog(message) {
    if (!this.hud) {
      return;
    }

    this.hud.addLog(message);
  }

  spawnLoot(x, y) {
    return this.lootSystem.spawnLoot(x, y);
  }


  applyHazardDamage() {
    this.hazardSystem.applyHazardDamage();
  }

  updateHud() {
    if (!this.hud) {
      return;
    }

    const bag = this.inventorySystem.getSnapshot();
    this.hud.update(this.player, bag);
  }

  createRunSummary(result) {
    return this.settlementSystem.createRunSummary(result);
  }

  checkDeath() {
    this.hazardSystem.checkDeath();
  }

}

window.DungeonScene = DungeonScene;
