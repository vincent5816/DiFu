class StateSnapshot {
  static create(scene, event) {
    return StateSnapshot.measure(scene, 'StateSnapshot.create', {
      eventType: event.type,
      entityId: event.entityId || null
    }, () => ({
      event: {
        type: event.type,
        entityId: event.entityId || null,
        details: event.details || {}
      },
      player: StateSnapshot.measure(scene, 'StateSnapshot.player', {}, () => StateSnapshot.createPlayerSnapshot(scene)),
      location: StateSnapshot.createLocationSnapshot(scene),
      vision: StateSnapshot.measure(scene, 'StateSnapshot.vision', {}, () => StateSnapshot.createVisionSnapshot(scene)),
      knownEnemies: StateSnapshot.measure(scene, 'StateSnapshot.knownEnemies', {}, () => StateSnapshot.createKnownEnemySnapshot(scene)),
      combat: StateSnapshot.measure(scene, 'StateSnapshot.combat', {}, () => StateSnapshot.createCombatSnapshot(scene)),
      strategyConfig: StateSnapshot.createStrategyConfigSnapshot(scene)
    }));
  }

  static measure(scene, label, context, callback) {
    const monitor = globalThis.PerformanceMonitor;
    if (!monitor) {
      return callback();
    }
    return monitor.measure(label, {
      roomId: scene.currentRoomId,
      floor: scene.currentFloor,
      ...context
    }, callback);
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
      mpRegenPerSecond: player.mpRegenPerSecond || 0,
      hpRegenPerSecond: player.hpRegenPerSecond || 0,
      hpLeechPerHit: player.hpLeechPerHit || 0,
      gold: player.gold,
      x: Math.round(player.sprite.x),
      y: Math.round(player.sprite.y),
      facing: player.facing || 1,
      currentTargetId: player.currentTargetId || null,
      currentMovementAction: player.currentMovementAction || null,
      movementActionRemainingMs: StateSnapshot.getRemainingMs(scene, player.movementActionUntil),
      isMoving: StateSnapshot.isPlayerMoving(scene),
      isAttacking: Boolean(player.isAttacking),
      currentAttackAction: player.currentAttackAction || null,
      attackActionRemainingMs: StateSnapshot.getRemainingMs(scene, player.attackActionUntil),
      isJumping: Boolean(player.isJumping),
      isDashing: Boolean(player.isDashing),
      isDefending: Boolean(player.isDefending),
      isInvincible: Boolean(player.isInvincible),
      canDoubleJump: Boolean(player.isJumping && !player.doubleJumpUsed),
      dashCooldownMs: player.dashCooldownMs || 5000,
      dashCooldownRemainingMs: Math.max(0, (player.dashCooldownMs || 5000) - (scene.time.now - player.lastDashAt)),
      defendRemainingMs: player.isDefending ? Math.max(0, Math.ceil(player.defendingUntil - scene.time.now)) : 0,
      attackDamage: player.attackDamage,
      attackDamageMin: player.attackDamageMin || player.attackDamage,
      attackDamageMax: player.attackDamageMax || player.attackDamage,
      attackRange: player.attackRange,
      attackCooldownMs: player.attackCooldownMs,
      attackSpeed: player.attackSpeed || 0,
      attackCooldownRemainingMs: Math.max(0, (player.attackCooldownMs || 0) - (scene.time.now - player.lastAttackAt)),
      moveSpeedPercent: player.moveSpeedPercent || 0,
      armor: player.armor || 0,
      damageReductionPercent: player.damageReductionPercent || 0,
      resistancePercent: player.resistancePercent || 0,
      critChancePercent: player.critChancePercent || 0,
      critDamagePercent: player.critDamagePercent || 0,
      skills: StateSnapshot.createSkillSnapshot(scene),
      buffs: player.buffs.map((buff) => ({
        type: buff.type,
        remainingTime: buff.remainingTime
      })),
      bag,
      equipment: scene.equipmentSystem ? scene.equipmentSystem.getSnapshot() : {}
    };
  }

  static createSkillSnapshot(scene) {
    const player = scene.player;
    const skills = (player.skills || []).map((skillId) => {
      const skill = window.SkillsData && SkillsData.skills ? SkillsData.skills[skillId] : null;
      const readyAt = player.skillCooldowns ? player.skillCooldowns[skillId] || -Infinity : -Infinity;
      const cooldownRemainingMs = StateSnapshot.getRemainingMs(scene, readyAt);
      return {
        id: skillId,
        name: skill ? skill.name : skillId,
        active: skillId === player.activeSkillId,
        mpCost: skill ? skill.mpCost || 0 : 0,
        cooldownMs: skill ? StateSnapshot.getSkillCooldownMs(scene, skill) : 0,
        cooldownRemainingMs,
        ready: cooldownRemainingMs <= 0,
        tags: skill ? [...(skill.tags || [])] : [],
        element: skill ? skill.element || null : null
      };
    });

    return {
      activeSkillId: player.activeSkillId || null,
      activeSkill: skills.find((skill) => skill.active) || null,
      list: skills,
      supportSkillIds: [...(player.supportSkillIds || [])],
      supportSkills: (player.supportSkillIds || []).map((skillId) => {
        const skill = window.SkillsData && SkillsData.supportSkills ? SkillsData.supportSkills[skillId] : null;
        return {
          id: skillId,
          name: skill ? skill.name : skillId,
          tags: skill ? [...(skill.tags || [])] : [],
          element: skill ? skill.element || null : null
        };
      }),
      supportState: player.supportSkillState || {},
      activeEffects: (player.activeSkillEffects || []).map((effect) => ({
        skillId: effect.skillId,
        remainingMs: StateSnapshot.getRemainingMs(scene, effect.expiresAt),
        nextTickInMs: StateSnapshot.getRemainingMs(scene, effect.nextTickAt),
        radius: effect.radius || null
      })),
      reflect: player.activeReflect
        ? {
          skillId: player.activeReflect.skillId,
          remainingMs: StateSnapshot.getRemainingMs(scene, player.activeReflect.expiresAt),
          reflectPercent: player.activeReflect.reflectPercent || 1
        }
        : null,
      stats: player.skillStats || {}
    };
  }

  static getSkillCooldownMs(scene, skill) {
    const reduction = scene.player.skillStats ? scene.player.skillStats.cooldownReductionPercent || 0 : 0;
    const floorMs = window.SkillsData && SkillsData.skillCooldownFloorMs !== undefined
      ? SkillsData.skillCooldownFloorMs
      : 250;
    return Math.max(floorMs, Math.round((skill.cooldownMs || 0) * (1 - reduction)));
  }

  static createBagSnapshot(bag) {
    return {
      slots: bag.slots,
      used: bag.used,
      items: bag.items.map((item) => ({
        id: item.id,
        quality: item.quality,
        kind: item.kind || 'equipment',
        itemLevel: item.itemLevel || 1,
        slot: item.slot || null,
        qualityRank: item.qualityRank || null,
        identified: Boolean(item.identified),
        manualDesignRequired: Boolean(item.manualDesignRequired),
        baseId: item.identified ? item.baseId || null : null,
        baseName: item.identified ? item.baseName || null : null,
        baseTier: item.identified ? item.baseTier || null : null,
        baseType: item.identified ? item.baseType || null : null,
        baseStats: item.identified ? { ...(item.baseStats || {}) } : {},
        affixes: item.identified
          ? (item.affixes || []).map((affix) => ({
            id: affix.id,
            stat: affix.stat || null,
            tier: affix.tier,
            value: affix.value,
            valueType: affix.valueType || 'flat',
            epicPromoted: Boolean(affix.epicPromoted)
          }))
          : []
      }))
    };
  }

  static getRemainingMs(scene, until) {
    if (until === Infinity) {
      return Infinity;
    }

    if (!Number.isFinite(until)) {
      return 0;
    }

    return Math.max(0, Math.ceil(until - scene.time.now));
  }

  static isPlayerMoving(scene) {
    const player = scene.player;
    return Boolean(
      player.currentMovementAction ||
      player.manualMove ||
      player.isJumping ||
      player.isDashing ||
      scene.isRetreating
    );
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
      .map((entity) => {
        const attackDistance = StateSnapshot.getAttackDistance(scene, entity);
        const attackRange = scene.player.attackRange || 0;
        return {
          id: entity.id,
          kind: entity.kind,
          type: entity.type,
          hp: entity.hp === undefined ? null : entity.hp,
          maxHp: entity.maxHp === undefined ? null : entity.maxHp,
          amount: entity.amount || 0,
          cost: entity.cost || 0,
          healRatio: entity.healRatio || 0,
          direction: StateSnapshot.getDirection(scene.player, entity),
          distance: StateSnapshot.getDistance(scene.player, entity),
          attackDistance: attackDistance === null ? null : Math.ceil(attackDistance),
          attackRange,
          inAttackRange: attackDistance !== null && attackDistance <= attackRange,
          combatState: entity.combatState ? entity.combatState.phase : null
        };
      });
  }

  static createKnownEnemySnapshot(scene) {
    return scene.entities
      .filter((entity) => entity.active && entity.kind === 'enemy' && entity.sprite)
      .map((entity) => {
        const attackDistance = StateSnapshot.getAttackDistance(scene, entity);
        const attackRange = scene.player.attackRange || 0;
        return {
          id: entity.id,
          kind: entity.kind,
          type: entity.type,
          hp: entity.hp === undefined ? null : entity.hp,
          maxHp: entity.maxHp === undefined ? null : entity.maxHp,
          direction: StateSnapshot.getDirection(scene.player, entity),
          distance: StateSnapshot.getDistance(scene.player, entity),
          attackDistance: attackDistance === null ? null : Math.ceil(attackDistance),
          attackRange,
          inAttackRange: attackDistance !== null && attackDistance <= attackRange,
          visible: StateSnapshot.isInVision(scene.player, entity, scene.visionRadius),
          combatState: entity.combatState ? entity.combatState.phase : null
        };
      });
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

  static getAttackDistance(scene, entity) {
    if (entity.kind !== 'enemy') {
      return null;
    }

    if (scene.combatSystem && typeof scene.combatSystem.getPlayerEntityBoundsDistance === 'function') {
      return scene.combatSystem.getPlayerEntityBoundsDistance(entity);
    }

    return Phaser.Math.Distance.Between(
      scene.player.sprite.x,
      scene.player.sprite.y,
      entity.sprite.x,
      entity.sprite.y
    );
  }
}

window.StateSnapshot = StateSnapshot;
