class MapSystem {
  constructor(scene) {
    this.scene = scene;
    this.floorData = Floor1Data;
    this.roomFrameObjects = [];
    this.roomObjects = [];
  }

  createRoom() {
    const frame = this.floorData.roomFrame;
    this.roomFrameObjects.push(this.scene.add.rectangle(frame.x, frame.y, frame.width, frame.height, frame.fillColor));
    this.roomFrameObjects.push(
      this.scene.add.rectangle(frame.x, frame.y, frame.width, frame.height).setStrokeStyle(2, frame.borderColor)
    );
  }

  loadRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return false;
    }

    this.clearRoomObjects();
    this.scene.currentRoomId = room.id;
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
    this.scene.player.sprite.y = room.playerStart.y;
    this.scene.updateEntityLabels();
  }

  getRoom(roomId) {
    return this.floorData.rooms.find((room) => room.id === roomId) || null;
  }

  createZone(config) {
    if (!config) {
      return null;
    }

    const zone = this.scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor, config.alpha);
    this.roomObjects.push(zone);

    if (config.label) {
      this.roomObjects.push(this.scene.add.text(config.label.x, config.label.y, config.label.text, {
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
      combat: mergedConfig.combat || null,
      encounterRadius: mergedConfig.encounterRadius,
      sprite: this.scene.add.rectangle(
        mergedConfig.x,
        mergedConfig.y,
        mergedConfig.width,
        mergedConfig.height,
        mergedConfig.fillColor,
        mergedConfig.alpha === undefined ? 1 : mergedConfig.alpha
      ),
      label: this.scene.add.text(mergedConfig.label.x, mergedConfig.label.y, mergedConfig.label.text, {
        fontSize: '14px',
        color: mergedConfig.label.color
      }),
      visuals: []
    };

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
    if (entity.kind !== 'enemy' || !config.combat) {
      return [];
    }

    if (config.combat.attackType === 'ranged') {
      const eye = this.createOffsetCircle(entity, 12, -16, 7, 0xffd166, 0.95);
      const bow = this.createOffsetRectangle(entity, 19, 0, 5, 34, 0xffd166, 0.9);
      bow.setRotation(0.25);
      eye.setDepth(4);
      bow.setDepth(4);
      return [eye, bow];
    }

    if (config.combat.attackType === 'melee') {
      const guard = this.createOffsetRectangle(entity, 16, -6, 8, 36, 0xf2eee2, 0.9);
      const hilt = this.createOffsetRectangle(entity, 10, 9, 18, 5, 0x8f887b, 0.95);
      guard.setRotation(-0.62);
      hilt.setRotation(-0.62);
      guard.setDepth(4);
      hilt.setDepth(4);
      return [guard, hilt];
    }

    if (config.combat.attackType === 'contact') {
      const core = this.createOffsetCircle(entity, 0, 0, 10, 0xf6e05e, 0.7);
      const shell = this.createOffsetCircle(entity, 0, 0, 18, 0xd6bcfa, 0.18);
      core.setDepth(4);
      shell.setDepth(3);
      return [shell, core];
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
      const sprite = this.scene.add.rectangle(door.x, door.y, door.width, door.height, door.fillColor);
      const label = this.scene.add.text(door.label.x, door.label.y, door.label.text, {
        fontSize: '14px',
        color: door.label.color
      });
      this.roomObjects.push(sprite, label);
    });
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
