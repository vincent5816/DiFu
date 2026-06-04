class EventSystem {
  constructor(scene, agentRunner, commandExecutor) {
    this.scene = scene;
    this.agentRunner = agentRunner;
    this.commandExecutor = commandExecutor;
    this.handledEntityEvents = new Set();
    this.enabled = true;
    this.pendingEntityId = null;
    this.nextDispatchAt = 0;
    this.dispatchCooldown = 650;
    this.stateEventCooldowns = new Map();
    this.activeStateEvents = new Set();
    this.visibleEntityIds = new Set();
    this.maxCommandPlanLength = 5;
    this.maxCommandDelayMs = 3000;
  }

  update() {
    this.detectVisionChanges();
    this.updateReturnPointDistance();

    if (this.scene.isRetreating) {
      return;
    }

    if (!this.enabled) {
      return;
    }

    if (this.scene.player.combatHoldSourceId) {
      return;
    }

    const combatThreat = this.scene.combatSystem.consumeThreatEvent(this.scene.strategyConfig);
    if (combatThreat) {
      this.scene.isEncounterLocked = true;
      this.nextDispatchAt = this.scene.time.now + 80;
      this.dispatch({
        type: 'STATE_COMBAT_THREAT',
        entityId: combatThreat.sourceId,
        details: {
          threatType: combatThreat.type,
          sourceType: combatThreat.sourceType,
          ...combatThreat.details
        }
      });
      return;
    }

    if (this.scene.time.now < this.nextDispatchAt) {
      return;
    }

    if (this.scene.pendingNewRoomEvent) {
      this.scene.pendingNewRoomEvent = false;
      this.scene.isEncounterLocked = true;
      this.nextDispatchAt = this.scene.time.now + this.dispatchCooldown;
      this.dispatch({
        type: 'STATE_NEW_ROOM',
        entityId: null
      });
      return;
    }

    const stateEvent = this.detectStateEvent();
    if (stateEvent) {
      this.scene.isEncounterLocked = true;
      this.nextDispatchAt = this.scene.time.now + this.dispatchCooldown;
      this.dispatch(stateEvent);
      return;
    }

    const encounter = this.findEncounterEntity();

    if (encounter && !this.handledEntityEvents.has(encounter.id)) {
      this.pendingEntityId = encounter.id;
      this.scene.isEncounterLocked = true;
      this.nextDispatchAt = this.scene.time.now + this.dispatchCooldown;
      this.scene.unlockCodexForEntity(encounter);
      this.dispatch({
        type: this.getEncounterEventType(encounter),
        entityId: encounter.id
      });
      return;
    }

    if (!encounter && this.pendingEntityId) {
      this.pendingEntityId = null;
      this.scene.isEncounterLocked = false;
    }
  }

  dispatch(event) {
    console.log('[EventSystem] Event triggered:', event);
    this.scene.recordRunEvent(event.type, {
      entityId: event.entityId || null,
      ...(event.details || {})
    });
    this.scene.addLog(`Event: ${event.type} (${event.entityId || 'none'})`);
    const snapshot = StateSnapshot.create(this.scene, event);
    console.log('[StateSnapshot]', snapshot);
    this.scene.addLog(`Snapshot: vision=${snapshot.vision.length}, hp=${snapshot.player.hp}/${snapshot.player.maxHp}`);
    this.scene.addLog(`Vision: ${this.formatVision(snapshot.vision)}`);
    const command = this.agentRunner.run(snapshot);
    console.log('[AgentRunner] Command returned:', command);
    const plan = this.createCommandPlan(command, snapshot);
    this.scene.addLog(`Agent: ${plan.map((entry) => entry.command.action).join(' -> ')}`);

    this.enabled = false;
    this.executeCommandPlan(plan, snapshot, event);
  }

  createCommandPlan(result, snapshot) {
    const rawEntries = this.extractCommandEntries(result).slice(0, this.maxCommandPlanLength);
    const entries = rawEntries
      .map((entry) => this.normalizeCommandEntry(entry, snapshot))
      .filter((entry) => entry && entry.command);

    if (entries.length === 0) {
      return [{ delayMs: 0, command: { action: 'WAIT' } }];
    }

    return entries;
  }

  extractCommandEntries(result) {
    if (Array.isArray(result)) {
      return result;
    }

    if (result && Array.isArray(result.actions)) {
      return result.actions;
    }

    if (result && Array.isArray(result.commands)) {
      return result.commands;
    }

    return [result];
  }

  normalizeCommandEntry(entry, snapshot) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const delayMs = Phaser.Math.Clamp(
      Math.round(Number(entry.delayMs) || 0),
      0,
      this.maxCommandDelayMs
    );
    const command = entry.command && typeof entry.command === 'object'
      ? { ...entry.command }
      : { ...entry };
    delete command.delayMs;
    delete command.command;

    if (command.targetId === '$sourceId') {
      command.targetId = snapshot.event.entityId;
    }
    if (command.itemId === '$sourceId') {
      command.itemId = snapshot.event.entityId;
    }

    return { delayMs, command };
  }

  executeCommandPlan(plan, snapshot, event) {
    const baseDelay = this.getCommandDelay(event);
    let elapsedDelay = baseDelay;
    const lastIndex = plan.length - 1;

    plan.forEach((entry, index) => {
      elapsedDelay += entry.delayMs;
      this.scene.time.delayedCall(elapsedDelay, () => {
        this.commandExecutor.execute(entry.command, snapshot);
        if (index !== lastIndex) {
          return;
        }

        this.scene.isEncounterLocked = this.hasBlockingEncounter() || this.hasBlockingState(entry.command, snapshot);
        this.enabled = true;
      });
    });
  }

  getCommandDelay(event) {
    if (event.type === 'STATE_COMBAT_THREAT' || event.type === 'ENCOUNTER_ENEMY') {
      return 0;
    }

    return 450;
  }

  isInEncounterRange(entity) {
    const radius = this.getEncounterRadius(entity);
    if (
      entity.kind === 'enemy' &&
      this.scene.combatSystem &&
      typeof this.scene.combatSystem.getPlayerEntityBoundsDistance === 'function'
    ) {
      return this.scene.combatSystem.getPlayerEntityBoundsDistance(entity) <= radius;
    }

    return Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      entity.sprite.x,
      entity.sprite.y
    ) <= radius;
  }

  getEncounterRadius(entity) {
    if (entity.kind === 'enemy') {
      return this.scene.player.attackRange || this.scene.encounterRadius;
    }

    return entity.encounterRadius || this.scene.encounterRadius;
  }

  markEntityResolved(entityId) {
    this.handledEntityEvents.add(entityId);
    if (this.pendingEntityId === entityId) {
      this.pendingEntityId = null;
    }
    this.scene.isEncounterLocked = this.hasBlockingEncounter();
  }

  hasBlockingEncounter() {
    return this.scene.entities.some((entity) => {
      return entity.active &&
        this.isEncounterKind(entity.kind) &&
        !this.handledEntityEvents.has(entity.id) &&
        this.shouldDispatchEncounter(entity);
    });
  }

  findEncounterEntity() {
    return this.scene.entities
      .filter((entity) => {
        return entity.active &&
          this.isEncounterKind(entity.kind) &&
          !this.handledEntityEvents.has(entity.id) &&
          this.shouldDispatchEncounter(entity);
      })
      .sort((a, b) => {
        return this.getEncounterDistance(a) - this.getEncounterDistance(b);
      })[0] || null;
  }

  shouldDispatchEncounter(entity) {
    if (this.isActiveCombatEnemyTarget(entity)) {
      return true;
    }

    return this.isInEncounterRange(entity);
  }

  isActiveCombatEnemyTarget(entity) {
    return entity.kind === 'enemy' &&
      this.scene.isPlayerCombatEngaged;
  }

  getEncounterDistance(entity) {
    if (
      entity.kind === 'enemy' &&
      this.scene.combatSystem &&
      typeof this.scene.combatSystem.getPlayerEntityBoundsDistance === 'function'
    ) {
      return this.scene.combatSystem.getPlayerEntityBoundsDistance(entity);
    }

    return Phaser.Math.Distance.Between(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      entity.sprite.x,
      entity.sprite.y
    );
  }

  isEncounterKind(kind) {
    return kind === 'enemy' || kind === 'chest' || kind === 'loot' || kind === 'return_point';
  }

  getEncounterEventType(entity) {
    if (entity.kind === 'return_point') {
      return 'ENCOUNTER_RETURN_POINT';
    }
    if (entity.kind === 'chest') {
      return 'ENCOUNTER_CHEST';
    }
    if (entity.kind === 'loot') {
      return 'ENCOUNTER_LOOT';
    }
    return 'ENCOUNTER_ENEMY';
  }

  hasBlockingState(command, snapshot) {
    return snapshot.event.type === 'STATE_HP_LOW' &&
      command.action === 'WAIT' &&
      this.scene.player.hp / this.scene.player.maxHp <= this.scene.strategyConfig.hpLowThreshold;
  }

  detectStateEvent() {
    const hpRatio = this.scene.player.hp / this.scene.player.maxHp;
    const hpThreshold = this.scene.strategyConfig.hpLowThreshold;

    if (hpRatio > hpThreshold) {
      this.activeStateEvents.delete('STATE_HP_LOW');
    }

    if (
      hpRatio <= hpThreshold &&
      !this.activeStateEvents.has('STATE_HP_LOW') &&
      this.canDispatchStateEvent('STATE_HP_LOW')
    ) {
      this.activeStateEvents.add('STATE_HP_LOW');
      return {
        type: 'STATE_HP_LOW',
        entityId: null
      };
    }

    if (this.shouldDispatchBagFull()) {
      this.activeStateEvents.add('STATE_BAG_FULL');
      return {
        type: 'STATE_BAG_FULL',
        entityId: this.getNearestLootId()
      };
    }

    return null;
  }

  shouldDispatchBagFull() {
    if (this.activeStateEvents.has('STATE_BAG_FULL')) {
      return false;
    }

    if (!this.scene.inventorySystem.isFull()) {
      this.activeStateEvents.delete('STATE_BAG_FULL');
      return false;
    }

    return Boolean(this.getNearestLootId()) && this.canDispatchStateEvent('STATE_BAG_FULL');
  }

  getNearestLootId() {
    const loot = this.scene.entities
      .filter((entity) => {
        return entity.active &&
          entity.kind === 'loot' &&
          this.isInEncounterRange(entity);
      })
      .sort((a, b) => {
        const da = Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, a.sprite.x, a.sprite.y);
        const db = Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, b.sprite.x, b.sprite.y);
        return da - db;
      })[0];

    return loot ? loot.id : null;
  }

  canDispatchStateEvent(type) {
    const now = this.scene.time.now;
    const nextAllowedAt = this.stateEventCooldowns.get(type) || 0;

    if (now < nextAllowedAt) {
      return false;
    }

    this.stateEventCooldowns.set(type, now + 1200);
    return true;
  }

  clearStateEvent(type) {
    this.activeStateEvents.delete(type);
  }

  formatVision(vision) {
    if (!vision || vision.length === 0) {
      return 'none';
    }

    return vision
      .map((entity) => `${entity.type}:${entity.distance}:${entity.direction}`)
      .join(', ');
  }

  detectVisionChanges() {
    const currentVisibleIds = new Set();

    this.scene.entities.forEach((entity) => {
      if (!entity.active || !StateSnapshot.isInVision(this.scene.player, entity, this.scene.visionRadius)) {
        return;
      }

      currentVisibleIds.add(entity.id);
      if (!this.visibleEntityIds.has(entity.id)) {
        const direction = StateSnapshot.getDirection(this.scene.player, entity);
        const distance = StateSnapshot.getDistance(this.scene.player, entity);
        this.scene.recordRunEvent('VISION_ENTITY_ENTERED', {
          entityId: entity.id,
          type: entity.type,
          direction,
          distance
        });
        this.scene.addLog(`Vision entered: ${entity.type}:${distance}:${direction}`);
        this.handleVisionEntityEntered(entity, distance);
      }
    });

    this.visibleEntityIds = currentVisibleIds;
  }

  handleVisionEntityEntered(entity, distance) {
    if (entity.kind !== 'return_point' || this.scene.returnPointKnown) {
      return;
    }

    this.scene.returnPointKnown = true;
    this.scene.returnPointDistance = distance;
    this.scene.recordRunEvent('RETURN_POINT_DISCOVERED', {
      entityId: entity.id,
      distance
    });
    this.scene.addLog(`Return point discovered: ${distance}`);
  }

  updateReturnPointDistance() {
    if (!this.scene.returnPointKnown) {
      return;
    }

    const returnPoint = this.scene.entities.find((entity) => {
      return entity.active && entity.kind === 'return_point';
    });
    if (!returnPoint) {
      this.scene.returnPointKnown = false;
      this.scene.returnPointDistance = 'far';
      return;
    }

    const nextDistance = StateSnapshot.getDistance(this.scene.player, returnPoint);
    if (nextDistance === this.scene.returnPointDistance) {
      return;
    }

    this.scene.returnPointDistance = nextDistance;
    this.scene.recordRunEvent('RETURN_POINT_DISTANCE_CHANGED', {
      entityId: returnPoint.id,
      distance: nextDistance
    });
    this.scene.addLog(`Return distance: ${nextDistance}`);
  }
}

window.EventSystem = EventSystem;
