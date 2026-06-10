class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  create() {
    try {
      this.createRun();
    } catch (error) {
      this.showStartupError(error);
      throw error;
    }
  }

  createRun() {
    this.currentFloor = 1;
    this.currentRoomId = 'room_001';
    this.returnPointKnown = false;
    this.returnPointDistance = 'far';
    this.visionRadius = 170;
    this.encounterRadius = 120;
    this.autoAdvanceSpeed = 100;
    this.roomArtOffsetY = 108;
    this.runSpeedMultiplier = this.getInitialRunSpeedMultiplier();
    this.isEncounterLocked = false;
    this.isPlayerCombatEngaged = false;
    this.isRunComplete = false;
    this.pendingNewRoomEvent = false;
    this.strategyConfig = window.hellSurvivalStrategyConfig || StrategyConfig.load();
    this.newCodexEntries = [];
    this.entities = [];
    this.visionCircle = null;
    this.roomBackground = null;
    this.roomBackgroundDimmer = null;
    this.roomBackgroundKey = null;
    this.visualDebugEnabled = false;
    this.visualDebugGraphics = null;

    this.createRoomBackground();
    this.mapSystem = new MapSystem(this);
    this.mapSystem.createRoom();
    this.createPlayer();
    this.createSystems();
    this.createVisionCircle();
    this.mapSystem.loadRoom(this.currentRoomId);
    this.updateEntityLabels();
    this.createLabels();
    this.applyRunSpeedMultiplier();
    this.addLog('Dungeon ready');
  }

  getInitialRunSpeedMultiplier() {
    const saved = Number(window.HELL_SURVIVAL_RUN_SPEED || 1);
    return [1, 2, 3].includes(saved) ? saved : 1;
  }

  getRunDeltaSeconds() {
    const multiplier = this.runSpeedMultiplier || 1;
    return (this.game.loop.delta * multiplier) / 1000;
  }

  setRunSpeedMultiplier(multiplier) {
    const next = [1, 2, 3].includes(multiplier) ? multiplier : 1;
    if (this.runSpeedMultiplier === next) {
      return;
    }

    this.runSpeedMultiplier = next;
    window.HELL_SURVIVAL_RUN_SPEED = next;
    this.applyRunSpeedMultiplier();
    this.recordRunEvent('RUN_SPEED_CHANGED', {
      speedMultiplier: next
    });
    this.showStatus(`探索速度：${next}x`);
    this.addLog(`Run speed: ${next}x`);
    this.updateHud();
  }

  cycleRunSpeedMultiplier() {
    const speeds = [1, 2, 3];
    const currentIndex = speeds.indexOf(this.runSpeedMultiplier || 1);
    const next = speeds[(currentIndex + 1) % speeds.length];
    this.setRunSpeedMultiplier(next);
  }

  applyRunSpeedMultiplier() {
    const multiplier = this.runSpeedMultiplier || 1;
    if (this.time) {
      this.time.timeScale = multiplier;
    }
    if (this.tweens) {
      this.tweens.timeScale = multiplier;
    }
  }

  showStartupError(error) {
    console.error('[DungeonScene] Startup failed:', error);
    const message = error && error.stack ? error.stack : String(error);
    const panel = document.createElement('div');
    panel.className = 'game-dom-panel startup-error-panel';
    panel.innerHTML = `
      <div class="game-dom-header">
        <h1>地牢启动失败</h1>
        <p>请把下面的错误信息发给开发者。</p>
      </div>
      <pre>${this.escapeHtml(message)}</pre>
    `;
    document.body.appendChild(panel);
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  update() {
    this.reportFrameHitch();
    this.regeneratePlayerResources();
    this.applyHazardDamage();
    this.combatSystem.update();
    this.updateHud();
    this.checkDeath();
    this.updateRetreat();
    this.updateManualMove();
    this.autoAdvance();
    this.eventSystem.update();
  }

  reportFrameHitch() {
    const monitor = globalThis.PerformanceMonitor;
    if (!monitor || !this.game || !this.game.loop) {
      return;
    }

    monitor.reportFrame(this.game.loop.delta, {
      roomId: this.currentRoomId,
      floor: this.currentFloor,
      speedMultiplier: this.runSpeedMultiplier || 1,
      isEncounterLocked: Boolean(this.isEncounterLocked)
    });
  }

  regeneratePlayerResources() {
    if (!this.player || this.isRunComplete) {
      return;
    }

    const deltaSeconds = this.getRunDeltaSeconds();
    if (this.player.mpRegenPerSecond > 0 && this.player.mp < this.player.maxMp) {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + this.player.mpRegenPerSecond * deltaSeconds);
    }
    if (this.player.hpRegenPerSecond > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.hpRegenPerSecond * deltaSeconds);
    }
  }

  createPlayer() {
    const data = PlayerData;
    const buildConfig = globalThis.StorageSystem
      ? StorageSystem.getBuildConfig()
      : {
        activeSkillId: data.activeSkillId || (window.SkillsData && SkillsData.defaultActiveSkillId) || null,
        supportSkillIds: data.supportSkillIds || []
      };
    const sprite = this.createPlayerSprite(180, 270 + (this.roomArtOffsetY || 0), data);
    const activeSkillId = buildConfig.activeSkillId || data.activeSkillId || (window.SkillsData && SkillsData.defaultActiveSkillId) || null;
    this.player = {
      id: data.id,
      type: 'player',
      sprite,
      hitboxWidth: data.width,
      hitboxHeight: data.height,
      label: this.add.text(sprite.x - 20, sprite.y + 66, data.label.text, {
        fontSize: '14px',
        color: data.label.color
      }),
      hp: data.hp,
      maxHp: data.maxHp,
      mp: data.mp,
      maxMp: data.maxMp,
      mpRegenPerSecond: data.mpRegenPerSecond || 0,
      hpRegenPerSecond: data.hpRegenPerSecond || 0,
      hpLeechPerHit: data.hpLeechPerHit || 0,
      skills: activeSkillId ? [activeSkillId] : [],
      activeSkillId,
      unlockedActiveSkillIds: [...(data.unlockedActiveSkillIds || data.skills || [])],
      supportSkillIds: [...(buildConfig.supportSkillIds || data.supportSkillIds || [])].filter(Boolean).slice(0, 2),
      unlockedSupportSkillIds: [...(data.unlockedSupportSkillIds || data.supportSkillIds || [])],
      skillCooldowns: { ...(data.skillCooldowns || {}) },
      activeSkillEffects: [],
      activeReflect: null,
      supportSkillState: {
        emergencyShieldReadyAt: 0,
        chargeMarkTargetId: null,
        chargeMarkHits: 0,
        nextAttackCritChanceBonus: 0,
        takingDotDamageUntil: -Infinity,
        aftershockReady: false
      },
      attackDamage: data.attackDamage,
      attackRange: data.attackRange,
      attackCooldownMs: data.attackCooldownMs,
      moveSpeedPercent: data.moveSpeedPercent || 0,
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
      equipment: {},
      bag: {
        slots: data.bag.slots,
        used: data.bag.used,
        items: data.bag.items.map((item) => ({ ...item }))
      }
    };
  }

  getRoomBackgroundKey(roomId = this.currentRoomId) {
    if (roomId === 'room_002') {
      return 'room_background_2_1';
    }
    if (roomId === 'room_003') {
      return 'room_background_3_2';
    }
    if (roomId === 'room_004') {
      return 'room_background_4_6';
    }
    if (roomId === 'room_005') {
      return 'room_background_5_5';
    }
    if (roomId === 'room_006') {
      return 'room_background_6_1';
    }
    if (roomId === 'room_007') {
      return 'room_background_7_2';
    }
    if (roomId === 'room_008') {
      return 'room_background_8_3';
    }
    return 'room_background_1_3';
  }

  createRoomBackground(roomId = this.currentRoomId) {
    const backgroundKey = this.getRoomBackgroundKey(roomId);
    if (this.roomBackgroundKey === backgroundKey && this.roomBackground) {
      return;
    }

    if (!this.textures.exists(backgroundKey)) {
      console.warn(`[DungeonScene] ${backgroundKey} texture missing`);
      return;
    }

    if (this.roomBackground) {
      this.roomBackground.destroy();
      this.roomBackground = null;
    }
    if (this.roomBackgroundDimmer) {
      this.roomBackgroundDimmer.destroy();
      this.roomBackgroundDimmer = null;
    }

    this.roomBackgroundKey = backgroundKey;
    this.roomBackground = this.add.image(480, 270, backgroundKey);
    this.roomBackground.setOrigin(0.5, 0.5);
    this.roomBackground.setDisplaySize(960, 540);
    this.roomBackground.setDepth(-100);
    this.roomBackgroundDimmer = this.add.rectangle(480, 270, 960, 540, 0x05060a, 0.22);
    this.roomBackgroundDimmer.setDepth(-99);
  }

  createPlayerSprite(x, y, data) {
    if (!this.textures.exists('player_role')) {
      console.warn('[DungeonScene] player_role texture missing, using rectangle fallback');
      return this.add.rectangle(x, y, data.width, data.height, data.fillColor);
    }

    const container = this.add.container(x, y);
    container.setSize(data.width, data.height);
    container.width = data.width;
    container.height = data.height;
    container.logicalWidth = data.width;
    container.logicalHeight = data.height;

    const visual = this.add.image(0, -34, 'player_role');
    visual.setOrigin(0.5, 0.5);
    const roleTextureSource = this.textures.get('player_role').getSourceImage();
    const roleDisplayHeight = 185;
    const roleDisplayWidth = Math.round(roleDisplayHeight * (roleTextureSource.width / roleTextureSource.height));
    visual.setDisplaySize(roleDisplayWidth, roleDisplayHeight);
    visual.setDepth(0);
    visual.clearTint();
    container.add(visual);
    container.visual = visual;
    container.setFillStyle = (color) => {
      if (visual && typeof visual.setTint === 'function') {
        if (color === data.fillColor) {
          visual.clearTint();
        } else {
          visual.setTint(color);
        }
      }
      return container;
    };
    return container;
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
    this.equipmentSystem = new EquipmentSystem(this);
    this.equipmentSystem.initializePlayer(this.player);
    if (window.StorageSystem) {
      this.player.equipment = this.equipmentSystem.normalizeEquipment(StorageSystem.getEquipped());
      this.equipmentSystem.applyEquipmentStats(this.player, { preserveHpRatio: false });
    }
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
    const record = () => {
      this.runRecorder.record(type, details);
      if (details.sourceType) {
        ProgressSystem.recordObservedEvent(details.sourceType, type, details);
      }
    };

    const monitor = globalThis.PerformanceMonitor;
    if (!monitor) {
      record();
      return;
    }

    monitor.measure('DungeonScene.recordRunEvent', {
      roomId: this.currentRoomId,
      floor: this.currentFloor,
      eventType: type,
      sourceType: details.sourceType || null
    }, record);
  }

  hasActiveBoss() {
    return this.entities.some((entity) => {
      return entity.active && entity.kind === 'enemy' && entity.type === 'boss_floor1';
    });
  }

  unlockBossReturnPoint() {
    const unlockedEntities = this.entities.filter((entity) => {
      return entity.lockedUntilBossDefeated && !entity.active;
    });

    if (unlockedEntities.length === 0) {
      return;
    }

    unlockedEntities.forEach((entity) => {
      entity.active = true;
      this.mapSystem.setEntityVisible(entity, true);
    });
    this.returnPointKnown = false;
    this.returnPointDistance = 'far';
    this.recordRunEvent('BOSS_RETURN_POINT_UNLOCKED', {
      entityId: unlockedEntities.map((entity) => entity.id).join(',')
    });
    this.showStatus('Boss defeated: chest and return point appeared');
    this.addLog(`Boss unlocks: ${unlockedEntities.map((entity) => entity.id).join(', ')}`);
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
    this.input.keyboard.on('keydown-L', () => {
      this.printCurrentCombatLog();
    });
    this.input.keyboard.on('keydown-G', () => {
      this.toggleVisualDebugOverlay();
    });
    this.input.keyboard.on('keydown', (event) => {
      if (event.key === '1') {
        this.setRunSpeedMultiplier(1);
      } else if (event.key === '2') {
        this.setRunSpeedMultiplier(2);
      } else if (event.key === '3') {
        this.setRunSpeedMultiplier(3);
      }
    });
  }

  printCurrentCombatLog() {
    const activeEntities = this.entities
      .filter((entity) => entity.active)
      .map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        type: entity.type,
        x: entity.sprite ? Math.round(entity.sprite.x) : null,
        y: entity.sprite ? Math.round(entity.sprite.y) : null,
        hp: entity.hp === undefined ? null : Math.ceil(entity.hp),
        maxHp: entity.maxHp === undefined ? null : entity.maxHp,
        combatPhase: entity.combatState ? entity.combatState.phase : null,
        distanceToPlayer: entity.sprite
          ? Math.ceil(Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, entity.sprite.x, entity.sprite.y))
          : null
      }));
    const snapshot = StateSnapshot.create(this, {
      type: 'DEBUG_MANUAL_COMBAT_LOG',
      entityId: null,
      details: {}
    });
    const log = {
      note: 'Manual combat log. Press L in dungeon to print before combat ends.',
      codeVersion: window.HELL_SURVIVAL_CODE_VERSION || null,
      runSpeedMultiplier: this.runSpeedMultiplier || 1,
      printedAt: Math.round(this.time.now),
      floor: this.currentFloor,
      roomId: this.currentRoomId,
      isRunComplete: this.isRunComplete,
      isEncounterLocked: this.isEncounterLocked,
      isPlayerCombatEngaged: this.isPlayerCombatEngaged,
      pendingNewRoomEvent: this.pendingNewRoomEvent,
      player: {
        hp: Math.ceil(this.player.hp),
        maxHp: this.player.maxHp,
        gold: this.player.gold,
        x: Math.round(this.player.sprite.x),
        y: Math.round(this.player.sprite.y),
        currentTargetId: this.player.currentTargetId || null,
        currentMovementAction: this.player.currentMovementAction || null,
        currentAttackAction: this.player.currentAttackAction || null,
        attackCooldownRemainingMs: Math.max(0, Math.ceil((this.player.attackCooldownMs || 0) - (this.time.now - this.player.lastAttackAt)))
      },
      bag: this.inventorySystem.getSnapshot(),
      eventSystem: this.eventSystem ? this.eventSystem.getDebugSnapshot() : null,
      combat: {
        recentEvents: this.combatSystem.getRecentEventsSnapshot(),
        pendingThreats: this.combatSystem.pendingThreatEvents.map((event) => ({ ...event })),
        projectiles: this.combatSystem.projectiles
          .filter((projectile) => projectile.active)
          .map((projectile) => ({
            id: projectile.id,
            sourceId: projectile.sourceId,
            sourceType: projectile.sourceType,
            x: projectile.sprite ? Math.round(projectile.sprite.x) : null,
            y: projectile.sprite ? Math.round(projectile.sprite.y) : null
          }))
      },
      activeEntities,
      snapshot,
      events: this.runRecorder.getSnapshot()
    };

    console.groupCollapsed(`[Hell Survival] Manual combat log ${this.currentRoomId} @ ${Math.round(this.time.now)}ms`);
    console.log(log);
    console.log(JSON.stringify(log, null, 2));
    console.groupEnd();
    window.__HELL_SURVIVAL_LAST_COMBAT_LOG__ = log;
    this.showStatus('Debug combat log printed to console');
    this.addLog('Debug combat log printed: console / window.__HELL_SURVIVAL_LAST_COMBAT_LOG__');
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

  toggleVisualDebugOverlay() {
    this.visualDebugEnabled = !this.visualDebugEnabled;
    if (!this.visualDebugEnabled) {
      this.clearVisualDebugOverlay();
      this.showStatus('Visual debug OFF');
      this.addLog('Visual debug OFF');
      return;
    }

    this.updateVisualDebugOverlay();
    this.showStatus('Visual debug ON: baselines and hitboxes');
    this.addLog('Visual debug ON');
  }

  clearVisualDebugOverlay() {
    if (this.visualDebugGraphics) {
      this.visualDebugGraphics.destroy();
      this.visualDebugGraphics = null;
    }
  }

  updateVisualDebugOverlay() {
    if (!this.visualDebugEnabled) {
      return;
    }

    if (!this.visualDebugGraphics) {
      this.visualDebugGraphics = this.add.graphics();
      this.visualDebugGraphics.setDepth(99);
    }

    const graphics = this.visualDebugGraphics;
    graphics.clear();

    const frame = Floor1Data.roomFrame;
    const playerBaselineY = this.getPlayerVisualBaselineY();
    graphics.lineStyle(1, 0x78c2ff, 0.8);
    graphics.lineBetween(frame.x - frame.width / 2, playerBaselineY, frame.x + frame.width / 2, playerBaselineY);
    graphics.strokeRect(
      this.player.sprite.x - this.player.hitboxWidth / 2,
      this.player.sprite.y - this.player.hitboxHeight / 2,
      this.player.hitboxWidth,
      this.player.hitboxHeight
    );

    this.entities.forEach((entity) => {
      if (!entity.active || !entity.sprite) {
        return;
      }

      graphics.lineStyle(1, 0xffd166, 0.7);
      graphics.strokeRect(
        entity.sprite.x - entity.sprite.width / 2,
        entity.sprite.y - entity.sprite.height / 2,
        entity.sprite.width,
        entity.sprite.height
      );
      const baselineY = this.getEntityVisualBaselineY(entity);
      graphics.lineStyle(1, 0x76e0a6, 0.8);
      graphics.lineBetween(entity.sprite.x - 46, baselineY, entity.sprite.x + 46, baselineY);
    });
  }

  getPlayerVisualBaselineY() {
    if (!this.player || !this.player.sprite || !this.player.sprite.visual) {
      return this.player && this.player.sprite ? this.player.sprite.y + this.player.hitboxHeight / 2 : 0;
    }

    const visual = this.player.sprite.visual;
    return this.player.sprite.y + visual.y + visual.displayHeight / 2;
  }

  getEntityVisualBaselineY(entity) {
    if (entity.visuals && entity.visuals.length > 0) {
      const imageVisual = entity.visuals.find((visual) => visual && Number.isFinite(visual.displayHeight));
      if (imageVisual) {
        return imageVisual.y + imageVisual.displayHeight / 2;
      }
    }
    return entity.sprite.y + entity.sprite.height / 2;
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

  spawnPaperMoney(x, y, amount = null) {
    return this.lootSystem.spawnPaperMoney(x, y, amount);
  }


  applyHazardDamage() {
    this.hazardSystem.applyHazardDamage();
  }

  updateHud() {
    if (!this.hud) {
      return;
    }

    const update = () => {
      const bag = this.inventorySystem.getSnapshot();
      this.hud.update(this.player, bag);
    };

    const monitor = globalThis.PerformanceMonitor;
    if (!monitor) {
      update();
      return;
    }

    monitor.measure('DungeonScene.updateHud', {
      roomId: this.currentRoomId,
      floor: this.currentFloor
    }, update);
  }

  createRunSummary(result) {
    return this.settlementSystem.createRunSummary(result);
  }

  checkDeath() {
    this.hazardSystem.checkDeath();
  }

}

window.DungeonScene = DungeonScene;
