class MapSystem {
  constructor(scene) {
    this.scene = scene;
    this.floorData = Floor1Data;
    this.roomFrameObjects = [];
    this.roomObjects = [];
  }

  createRoom() {
    const frame = this.floorData.roomFrame;
    const border = this.scene.add.rectangle(frame.x, frame.y, frame.width, frame.height).setStrokeStyle(2, frame.borderColor);
    border.setDepth(0.5);
    this.roomFrameObjects.push(border);
  }

  loadRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return false;
    }

    this.clearRoomObjects();
    this.scene.currentRoomId = room.id;
    if (typeof this.scene.createRoomBackground === 'function') {
      this.scene.createRoomBackground(room.id);
    }
    this.scene.hazardZone = this.createZone(room.zones.softHazard);
    this.scene.deathZone = this.createZone(room.zones.death);
    this.scene.entities = room.entities.map((entity) => this.createEntity(entity));
    this.createDoors(room.doors || []);
    this.scene.isPlayerCombatEngaged = false;
    this.scene.returnPointKnown = false;
    this.scene.returnPointDistance = 'far';
    return true;
  }

  loadNextRoom() {
    const currentIndex = this.floorData.rooms.findIndex((room) => room.id === this.scene.currentRoomId);
    const nextRoom = this.floorData.rooms[currentIndex + 1];
    if (!nextRoom) {
      return false;
    }

    this.loadRoom(nextRoom.id);
    this.movePlayerToRoomStart(nextRoom);
    this.scene.isEncounterLocked = false;
    this.scene.isRetreating = false;
    this.scene.retreatTarget = null;
    this.scene.pendingNewRoomEvent = true;
    this.scene.addLog(`New room: ${nextRoom.id}`);
    return true;
  }

  movePlayerToRoomStart(room) {
    this.scene.player.sprite.x = room.playerStart.x;
    this.scene.player.sprite.y = this.getSceneY(room.playerStart.y);
    this.scene.updateEntityLabels();
  }

  getRoom(roomId) {
    return this.floorData.rooms.find((room) => room.id === roomId) || null;
  }

  createZone(config) {
    if (!config) {
      return null;
    }

    const zone = this.scene.add.rectangle(config.x, this.getSceneY(config.y), config.width, config.height, config.fillColor, config.alpha);
    this.roomObjects.push(zone);

    if (config.label) {
      this.roomObjects.push(this.scene.add.text(config.label.x, this.getSceneY(config.label.y), config.label.text, {
        fontSize: '13px',
        color: config.label.color
      }));
    }

    return zone;
  }

  createEntity(config) {
    const mergedConfig = this.mergeEntityConfig(config);
    const entity = {
      id: mergedConfig.id,
      kind: mergedConfig.kind,
      type: mergedConfig.type,
      active: mergedConfig.active !== false,
      lockedUntilBossDefeated: Boolean(mergedConfig.lockedUntilBossDefeated),
      hp: mergedConfig.hp || null,
      maxHp: mergedConfig.maxHp || mergedConfig.hp || null,
      gold: mergedConfig.gold || 0,
      cost: mergedConfig.cost || 0,
      healRatio: mergedConfig.healRatio || 0,
      combat: mergedConfig.combat || null,
      encounterRadius: mergedConfig.encounterRadius,
      sprite: this.scene.add.rectangle(
        mergedConfig.x,
        this.getSceneY(mergedConfig.y),
        mergedConfig.width,
        mergedConfig.height,
        mergedConfig.fillColor,
        mergedConfig.alpha === undefined ? 1 : mergedConfig.alpha
      ),
      label: this.scene.add.text(mergedConfig.label.x, this.getSceneY(mergedConfig.label.y), mergedConfig.label.text, {
        fontSize: '14px',
        color: mergedConfig.label.color
      }),
      visuals: []
    };

    if (mergedConfig.type === 'boss_floor1' && this.scene.textures.exists('boss_floor1_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'contact_a' && this.scene.textures.exists('contact_a_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'contact_b' && this.scene.textures.exists('contact_b_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'melee_a' && this.scene.textures.exists('melee_a_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'melee_b' && this.scene.textures.exists('melee_b_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'ranged_a' && this.scene.textures.exists('ranged_a_sprite')) {
      entity.sprite.setAlpha(0);
    }
    if (mergedConfig.type === 'ranged_b' && this.scene.textures.exists('ranged_b_sprite')) {
      entity.sprite.setAlpha(0);
    }
    entity.visuals = this.createEntityVisuals(entity, mergedConfig);
    this.roomObjects.push(entity.sprite, entity.label, ...entity.visuals);
    this.setEntityVisible(entity, entity.active);
    return entity;
  }

  setEntityVisible(entity, visible) {
    if (entity.sprite) {
      entity.sprite.setVisible(visible);
    }
    if (entity.label) {
      entity.label.setVisible(visible);
    }
    if (entity.visuals) {
      entity.visuals.forEach((visual) => visual.setVisible(visible));
    }
  }

  createEntityVisuals(entity, config) {
    if (entity.kind === 'heal_point') {
      const core = this.createOffsetCircle(entity, 0, 0, 16, 0x99ffd8, 0.35);
      const markH = this.createOffsetRectangle(entity, 0, 0, 28, 8, 0xf2eee2, 0.9);
      const markV = this.createOffsetRectangle(entity, 0, 0, 8, 28, 0xf2eee2, 0.9);
      core.setDepth(3);
      markH.setDepth(4);
      markV.setDepth(4);
      return [core, markH, markV];
    }

    if (entity.kind !== 'enemy' || !config.combat) {
      return [];
    }

    if (config.combat.attackType === 'ranged') {
      if (config.type === 'ranged_a' && this.scene.textures.exists('ranged_a_sprite')) {
        return [this.createRangedAVisual(entity)];
      }
      if (config.type === 'ranged_b' && this.scene.textures.exists('ranged_b_sprite')) {
        return [this.createRangedBVisual(entity)];
      }
      const eye = this.createOffsetCircle(entity, 12, -16, 7, 0xffd166, 0.95);
      const bow = this.createOffsetRectangle(entity, 19, 0, 5, 34, 0xffd166, 0.9);
      bow.setRotation(0.25);
      eye.setDepth(4);
      bow.setDepth(4);
      return [eye, bow];
    }

    if (config.combat.attackType === 'melee') {
      if (config.type === 'melee_a' && this.scene.textures.exists('melee_a_sprite')) {
        return [this.createMeleeAVisual(entity)];
      }
      if (config.type === 'melee_b' && this.scene.textures.exists('melee_b_sprite')) {
        return [this.createMeleeBVisual(entity)];
      }
      const guard = this.createOffsetRectangle(entity, 16, -6, 8, 36, 0xf2eee2, 0.9);
      const hilt = this.createOffsetRectangle(entity, 10, 9, 18, 5, 0x8f887b, 0.95);
      guard.setRotation(-0.62);
      hilt.setRotation(-0.62);
      guard.setDepth(4);
      hilt.setDepth(4);
      return [guard, hilt];
    }

    if (config.combat.attackType === 'contact') {
      if (config.type === 'contact_a' && this.scene.textures.exists('contact_a_sprite')) {
        return [this.createContactAVisual(entity)];
      }
      if (config.type === 'contact_b' && this.scene.textures.exists('contact_b_sprite')) {
        return [this.createContactBVisual(entity)];
      }
      const core = this.createOffsetCircle(entity, 0, 0, 10, 0xf6e05e, 0.7);
      const shell = this.createOffsetCircle(entity, 0, 0, 18, 0xd6bcfa, 0.18);
      core.setDepth(4);
      shell.setDepth(3);
      return [shell, core];
    }

    if (config.combat.attackType === 'boss' && config.type === 'boss_floor1' && this.scene.textures.exists('boss_floor1_sprite')) {
      return [this.createBossFloor1Visual(entity)];
    }

    if (config.combat.attackType === 'boss') {
      const crown = this.createOffsetRectangle(entity, 0, -38, 44, 10, 0xf2eee2, 0.9);
      const core = this.createOffsetCircle(entity, 0, -8, 16, 0xffd166, 0.65);
      const bladeA = this.createOffsetRectangle(entity, -26, 4, 8, 56, 0xf2eee2, 0.75);
      const bladeB = this.createOffsetRectangle(entity, 26, 4, 8, 56, 0xf2eee2, 0.75);
      bladeA.setRotation(0.18);
      bladeB.setRotation(-0.18);
      crown.setDepth(4);
      core.setDepth(4);
      bladeA.setDepth(4);
      bladeB.setDepth(4);
      return [crown, core, bladeA, bladeB];
    }

    if (config.combat.attackType === 'charge') {
      const hornA = this.createOffsetRectangle(entity, -8, -24, 8, 20, 0xffd166, 0.95);
      const hornB = this.createOffsetRectangle(entity, 8, -24, 8, 20, 0xffd166, 0.95);
      const core = this.createOffsetCircle(entity, 0, -2, 10, 0xff9fbd, 0.45);
      hornA.setRotation(-0.45);
      hornB.setRotation(0.45);
      hornA.setDepth(4);
      hornB.setDepth(4);
      core.setDepth(4);
      return [hornA, hornB, core];
    }

    return [];
  }

  createOffsetRectangle(entity, offsetX, offsetY, width, height, fillColor, alpha) {
    const visual = this.scene.add.rectangle(entity.sprite.x + offsetX, entity.sprite.y + offsetY, width, height, fillColor, alpha);
    visual._entityOffset = { x: offsetX, y: offsetY };
    return visual;
  }

  createOffsetCircle(entity, offsetX, offsetY, radius, fillColor, alpha) {
    const visual = this.scene.add.circle(entity.sprite.x + offsetX, entity.sprite.y + offsetY, radius, fillColor, alpha);
    visual._entityOffset = { x: offsetX, y: offsetY };
    return visual;
  }

  createBossFloor1Visual(entity) {
    const source = this.scene.textures.get('boss_floor1_sprite').getSourceImage();
    const displayHeight = 220;
    const displayWidth = Math.round(displayHeight * (source.width / source.height));
    const offsetY = this.getEntityVisualBaselineOffset(displayHeight);
    const visual = this.scene.add.image(entity.sprite.x, entity.sprite.y + offsetY, 'boss_floor1_sprite');
    visual.setOrigin(0.5, 0.5);
    visual.setDisplaySize(displayWidth, displayHeight);
    visual.setDepth(3);
    visual._entityOffset = { x: 0, y: offsetY };
    return visual;
  }

  createContactAVisual(entity) {
    return this.createContactVisual(entity, 'contact_a_sprite', 57);
  }

  createContactBVisual(entity) {
    return this.createContactVisual(entity, 'contact_b_sprite', 84);
  }

  createMeleeAVisual(entity) {
    return this.createMonsterBaselineVisual(entity, 'melee_a_sprite', 96);
  }

  createMeleeBVisual(entity) {
    return this.createMonsterBaselineVisual(entity, 'melee_b_sprite', 118);
  }

  createRangedAVisual(entity) {
    return this.createMonsterBaselineVisual(entity, 'ranged_a_sprite', 92);
  }

  createRangedBVisual(entity) {
    return this.createMonsterBaselineVisual(entity, 'ranged_b_sprite', 104);
  }

  createContactVisual(entity, textureKey, displayHeight) {
    return this.createMonsterBaselineVisual(entity, textureKey, displayHeight);
  }

  createMonsterBaselineVisual(entity, textureKey, displayHeight) {
    const source = this.scene.textures.get(textureKey).getSourceImage();
    const displayWidth = Math.round(displayHeight * (source.width / source.height));
    const offsetY = this.getEntityVisualBaselineOffset(displayHeight);
    const visual = this.scene.add.image(entity.sprite.x, entity.sprite.y + offsetY, textureKey);
    visual.setOrigin(0.5, 0.5);
    visual.setDisplaySize(displayWidth, displayHeight);
    visual.setDepth(3);
    visual._entityOffset = { x: 0, y: offsetY };
    return visual;
  }

  getEntityVisualBaselineOffset(displayHeight) {
    return Math.round(59 - displayHeight / 2);
  }

  mergeEntityConfig(config) {
    if (config.kind !== 'enemy') {
      return config;
    }

    const template = EnemyData[config.type] || {};
    return {
      ...template,
      ...config,
      combat: {
        ...(template.combat || {}),
        ...(config.combat || {})
      },
      label: {
        ...(template.label || {}),
        ...(config.label || {})
      }
    };
  }

  createDoors(doors) {
    doors.forEach((door) => {
      const sprite = this.scene.add.rectangle(door.x, this.getSceneY(door.y), door.width, door.height, door.fillColor);
      const label = this.scene.add.text(door.label.x, this.getSceneY(door.label.y), door.label.text, {
        fontSize: '14px',
        color: door.label.color
      });
      this.roomObjects.push(sprite, label);
    });
  }

  getSceneY(y) {
    return y + (this.scene.roomArtOffsetY || 0);
  }

  clearRoomObjects() {
    if (this.scene.combatSystem) {
      this.scene.combatSystem.clearRoomState(this.scene.entities);
    }

    this.roomObjects.forEach((object) => object.destroy());
    this.roomObjects = [];
  }
}

globalThis.MapSystem = MapSystem;
