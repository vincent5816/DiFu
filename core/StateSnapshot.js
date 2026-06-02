class StateSnapshot {
  static create(scene, event) {
    return {
      event: {
        type: event.type,
        entityId: event.entityId || null,
        details: event.details || {}
      },
      player: StateSnapshot.createPlayerSnapshot(scene),
      location: StateSnapshot.createLocationSnapshot(scene),
      vision: StateSnapshot.createVisionSnapshot(scene),
      combat: StateSnapshot.createCombatSnapshot(scene),
      strategyConfig: StateSnapshot.createStrategyConfigSnapshot(scene)
    };
  }

  static createPlayerSnapshot(scene) {
    const player = scene.player;
    const bag = scene.inventorySystem
      ? scene.inventorySystem.getSnapshot()
      : StateSnapshot.createBagSnapshot(player.bag);

    return {
      hp: player.hp,
      maxHp: player.maxHp,
      mp: player.mp,
      maxMp: player.maxMp,
      gold: player.gold,
      isJumping: Boolean(player.isJumping),
      attackDamage: player.attackDamage,
      attackRange: player.attackRange,
      attackCooldownMs: player.attackCooldownMs,
      buffs: player.buffs.map((buff) => ({
        type: buff.type,
        remainingTime: buff.remainingTime
      })),
      bag
    };
  }

  static createBagSnapshot(bag) {
    return {
      slots: bag.slots,
      used: bag.used,
      items: bag.items.map((item) => ({
        id: item.id,
        quality: item.quality
      }))
    };
  }

  static createLocationSnapshot(scene) {
    return {
      floor: scene.currentFloor,
      roomId: scene.currentRoomId,
      returnPointKnown: scene.returnPointKnown,
      returnPointDistance: scene.returnPointDistance
    };
  }

  static createVisionSnapshot(scene) {
    return scene.entities
      .filter((entity) => entity.active && StateSnapshot.isInVision(scene.player, entity, scene.visionRadius))
      .map((entity) => ({
        id: entity.id,
        type: entity.type,
        hp: entity.hp === undefined ? null : entity.hp,
        maxHp: entity.maxHp === undefined ? null : entity.maxHp,
        direction: StateSnapshot.getDirection(scene.player, entity),
        distance: StateSnapshot.getDistance(scene.player, entity),
        combatState: entity.combatState ? entity.combatState.phase : null
      }));
  }

  static createCombatSnapshot(scene) {
    if (!scene.combatSystem) {
      return {
        recentEvents: [],
        threats: [],
        projectiles: [],
        lastDamage: null,
        lastDodge: null
      };
    }

    return {
      recentEvents: scene.combatSystem.getRecentEventsSnapshot(),
      threats: scene.combatSystem.getThreatsSnapshot(),
      projectiles: scene.combatSystem.getProjectilesSnapshot(),
      lastDamage: scene.combatSystem.getLastEventSnapshot('PLAYER_DAMAGED'),
      lastDodge: scene.combatSystem.getLastEventSnapshot('PLAYER_DODGED')
    };
  }

  static createStrategyConfigSnapshot(scene) {
    const config = StrategyConfig.normalize(scene.strategyConfig || StrategyConfig.getDefault());
    return {
      hpLowThreshold: config.hpLowThreshold,
      dodgeProjectileDistance: config.dodgeProjectileDistance,
      windupResponseEnabled: config.windupResponseEnabled,
      windupResponseAction: config.windupResponseAction,
      windupReactionDelayMs: config.windupReactionDelayMs,
      projectileResponseEnabled: config.projectileResponseEnabled,
      projectileReactionDelayMs: config.projectileReactionDelayMs,
      enemyRules: config.enemyRules,
      combatRules: config.combatRules
    };
  }

  static isInVision(player, entity, radius) {
    return Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, entity.sprite.x, entity.sprite.y) <= radius;
  }

  static getDirection(player, entity) {
    const dx = entity.sprite.x - player.sprite.x;
    const dy = entity.sprite.y - player.sprite.y;
    const horizontal = dx < -20 ? 'left' : dx > 20 ? 'right' : '';
    const vertical = dy < -20 ? 'up' : dy > 20 ? 'down' : '';

    if (horizontal && vertical) {
      return `${horizontal}_${vertical}`;
    }
    return horizontal || vertical || 'same';
  }

  static getDistance(player, entity) {
    const distance = Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, entity.sprite.x, entity.sprite.y);
    if (distance < 120) {
      return 'near';
    }
    if (distance < 260) {
      return 'mid';
    }
    return 'far';
  }
}

window.StateSnapshot = StateSnapshot;
