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
      active: true,
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
    return entity;
  }

  createEntityVisuals(entity, config) {
    if (entity.kind !== 'enemy' || !config.combat) {
      return [];
    }

    if (config.combat.attackType === 'ranged') {
      const eye = this.scene.add.circle(entity.sprite.x + 12, entity.sprite.y - 16, 7, 0xffd166, 0.95);
      const bow = this.scene.add.rectangle(entity.sprite.x + 19, entity.sprite.y, 5, 34, 0xffd166, 0.9);
      bow.setRotation(0.25);
      eye.setDepth(4);
      bow.setDepth(4);
      return [eye, bow];
    }

    if (config.combat.attackType === 'melee') {
      const guard = this.scene.add.rectangle(entity.sprite.x + 16, entity.sprite.y - 6, 8, 36, 0xf2eee2, 0.9);
      const hilt = this.scene.add.rectangle(entity.sprite.x + 10, entity.sprite.y + 9, 18, 5, 0x8f887b, 0.95);
      guard.setRotation(-0.62);
      hilt.setRotation(-0.62);
      guard.setDepth(4);
      hilt.setDepth(4);
      return [guard, hilt];
    }

    return [];
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
