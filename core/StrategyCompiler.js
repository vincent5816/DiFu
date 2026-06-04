class StrategyCompiler {
  static compile(source) {
    const factory = new Function(`${source}
if (typeof onEvent === 'function') {
  return onEvent;
}
if (typeof window.DiFuAgent === 'function') {
  return window.DiFuAgent;
}
if (window.DiFuAgent && typeof window.DiFuAgent.onEvent === 'function') {
  return window.DiFuAgent.onEvent.bind(window.DiFuAgent);
}
if (window.DiFuAgent && typeof window.DiFuAgent.decide === 'function') {
  return window.DiFuAgent.decide.bind(window.DiFuAgent);
}
if (typeof window.HellSurvivalAgent === 'function') {
  return window.HellSurvivalAgent;
}
if (window.HellSurvivalAgent && typeof window.HellSurvivalAgent.onEvent === 'function') {
  return window.HellSurvivalAgent.onEvent.bind(window.HellSurvivalAgent);
}
if (window.HellSurvivalAgent && typeof window.HellSurvivalAgent.decide === 'function') {
  return window.HellSurvivalAgent.decide.bind(window.HellSurvivalAgent);
}
return null;`);
    const strategy = factory();

    if (typeof strategy !== 'function') {
      throw new Error('策略代码必须定义 function onEvent(snapshot)。');
    }

    strategy.__strategySource = source;
    strategy.__isDefaultStrategy = StrategyCompiler.isDefaultSource(source);
    return strategy;
  }

  static normalizeSource(source) {
    return String(source || '').replace(/\s+/g, '');
  }

  static isDefaultSource(source) {
    const normalized = StrategyCompiler.normalizeSource(source);
    if (!normalized) {
      return false;
    }

    return normalized === StrategyCompiler.normalizeSource(StrategyCompiler.getDefaultSource()) ||
      StrategyCompiler.getLegacyDefaultSources().some((legacySource) => {
        return normalized === StrategyCompiler.normalizeSource(legacySource);
      });
  }

  static isDefaultStrategy(strategy) {
    if (!strategy || typeof strategy !== 'function') {
      return false;
    }

    if (strategy.__isDefaultStrategy) {
      return true;
    }

    const source = strategy.__strategySource || strategy.toString();
    return StrategyCompiler.isDefaultSource(source) ||
      StrategyCompiler.hasLegacyDefaultSignature(source);
  }

  static hasLegacyDefaultSignature(source) {
    const normalized = StrategyCompiler.normalizeSource(source);
    return normalized.includes("STATE_HP_LOW") &&
      normalized.includes("action:'MOVE'") &&
      normalized.includes("direction:'right'") &&
      normalized.includes("STATE_COMBAT_THREAT") &&
      normalized.includes("PROJECTILE_SPAWNED") &&
      normalized.includes("ENCOUNTER_CHEST") &&
      normalized.includes("ENCOUNTER_ENEMY");
  }

  static getLegacyDefaultSources() {
    return [`function onEvent(snapshot) {
  const config = snapshot.strategyConfig || {};
  const dodgeDistance = config.dodgeProjectileDistance || 'near';
  const distanceRank = { near: 1, mid: 2, far: 3 };
  const shouldReactToDistance = (distance) => {
    return distanceRank[distance] <= distanceRank[dodgeDistance];
  };

  if (snapshot.event.type === 'STATE_HP_LOW') {
    return {
      action: 'MOVE',
      direction: 'right'
    };
  }

  if (snapshot.event.type === 'STATE_NEW_ROOM') {
    return {
      action: 'MOVE',
      direction: 'right'
    };
  }

  if (snapshot.event.type === 'STATE_COMBAT_THREAT') {
    const sourceType = snapshot.event.details.sourceType;
    const threatType = snapshot.event.details.threatType;
    const combatRule = config.combatRules &&
      config.combatRules[sourceType] &&
      config.combatRules[sourceType][threatType];
    const responseAction = combatRule ? combatRule.responseAction : 'wait';

    if (responseAction === 'wait') {
      return { action: 'WAIT' };
    }

    if (responseAction === 'move_left') {
      return {
        action: 'MOVE',
        direction: 'left'
      };
    }

    if (responseAction === 'move_right') {
      return {
        action: 'MOVE',
        direction: 'right'
      };
    }

    if (responseAction === 'attack') {
      return {
        action: 'ATTACK',
        targetId: snapshot.event.entityId,
        method: 'normal'
      };
    }

    if (responseAction === 'jump' && threatType !== 'PROJECTILE_SPAWNED') {
      return {
        action: 'JUMP'
      };
    }

    if (threatType !== 'PROJECTILE_SPAWNED') {
      return { action: 'WAIT' };
    }

    const incomingProjectile = snapshot.combat.projectiles.some((projectile) => {
      return projectile.incoming && shouldReactToDistance(projectile.distance);
    });

    if (incomingProjectile && responseAction === 'jump') {
      return {
        action: 'JUMP'
      };
    }

    return { action: 'WAIT' };
  }

  if (snapshot.event.type === 'ENCOUNTER_CHEST') {
    return {
      action: 'OPEN',
      targetId: snapshot.event.entityId
    };
  }

  if (snapshot.event.type === 'ENCOUNTER_LOOT') {
    return {
      action: 'PICKUP',
      targetId: snapshot.event.entityId
    };
  }

  if (snapshot.event.type === 'ENCOUNTER_RETURN_POINT') {
    return { action: 'RETREAT' };
  }

  if (snapshot.event.type === 'STATE_BAG_FULL') {
    const firstItem = snapshot.player.bag.items[0];
    if (firstItem) {
      return {
        action: 'DISCARD',
        itemId: firstItem.id
      };
    }
  }

  if (snapshot.event.type === 'ENCOUNTER_ENEMY') {
    return {
      action: 'ATTACK',
      targetId: snapshot.event.entityId,
      method: 'normal'
    };
  }

  return { action: 'WAIT' };
}`];
  }

  static getDefaultSource() {
    return `function onEvent(snapshot) {
  const boss = snapshot.vision.find((entity) => {
    return entity.type.includes('boss');
  });

  if (boss) {
    if (boss.inAttackRange) {
      if (snapshot.player.attackCooldownRemainingMs > 0) {
        return { action: 'WAIT' };
      }

      return {
        action: 'ATTACK',
        targetId: boss.id,
        method: 'normal'
      };
    }

    if (boss.direction.includes('left')) {
      return {
        action: 'MOVE',
        direction: 'left'
      };
    }

    if (boss.direction.includes('right')) {
      return {
        action: 'MOVE',
        direction: 'right'
      };
    }

    return {
      action: 'ATTACK',
      targetId: boss.id,
      method: 'normal'
    };
  }

  if (snapshot.event.type === 'STATE_HP_LOW') {
    return { action: 'WAIT' };
  }

  if (snapshot.event.type === 'STATE_NEW_ROOM') {
    return {
      action: 'MOVE',
      direction: 'right'
    };
  }

  if (snapshot.event.type === 'STATE_COMBAT_THREAT') {
    return { action: 'WAIT' };
  }

  if (snapshot.event.type === 'ENCOUNTER_CHEST') {
    return {
      action: 'OPEN',
      targetId: snapshot.event.entityId
    };
  }

  if (snapshot.event.type === 'ENCOUNTER_LOOT') {
    return {
      action: 'PICKUP',
      targetId: snapshot.event.entityId
    };
  }

  if (snapshot.event.type === 'ENCOUNTER_RETURN_POINT') {
    return { action: 'RETREAT' };
  }

  if (snapshot.event.type === 'STATE_BAG_FULL') {
    const firstItem = snapshot.player.bag.items[0];
    if (firstItem) {
      return {
        action: 'DISCARD',
        itemId: firstItem.id
      };
    }
  }

  if (snapshot.event.type === 'ENCOUNTER_ENEMY') {
    return {
      action: 'ATTACK',
      targetId: snapshot.event.entityId,
      method: 'normal'
    };
  }

  return { action: 'WAIT' };
}`;
  }
}

window.StrategyCompiler = StrategyCompiler;
