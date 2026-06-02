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
    this.autoAdvanceSpeed = 58;
    this.isEncounterLocked = false;
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
    this.updateCombatHold();
    this.autoAdvance();
    this.eventSystem.update();
  }

  createPlayer() {
    const data = PlayerData;
    const sprite = this.add.rectangle(180, 270, data.width, data.height, data.fillColor);
    const meleeHitRange = EnemyData.skeleton_guard &&
      EnemyData.skeleton_guard.combat &&
      EnemyData.skeleton_guard.combat.hitRange
      ? EnemyData.skeleton_guard.combat.hitRange
      : data.attackRange;
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
      attackRange: meleeHitRange,
      attackCooldownMs: data.attackCooldownMs,
      lastAttackAt: -Infinity,
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
  }

  createLabels() {
    this.hud = new HUD(this);
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }

  showStatus(message) {
    this.hud.showStatus(message);
  }

  autoAdvance() {
    this.movementSystem.autoAdvance();
  }

  movePlayer(direction, options) {
    this.movementSystem.movePlayer(direction, options);
  }

  jumpPlayer() {
    return this.movementSystem.jumpPlayer();
  }

  updateCombatHold() {
    this.movementSystem.updateCombatHold();
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
