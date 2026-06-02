class StrategyCompiler {
  static compile(source) {
    const factory = new Function(`${source}\nreturn onEvent;`);
    const strategy = factory();

    if (typeof strategy !== 'function') {
      throw new Error('策略代码必须定义 function onEvent(snapshot)。');
    }

    return strategy;
  }

  static getDefaultSource() {
    return `function onEvent(snapshot) {
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

    if (threatType === 'ENEMY_WINDUP') {
      if (responseAction === 'move_left') {
        return {
          action: 'MOVE',
          direction: 'left'
        };
      }

      if (responseAction === 'jump') {
        return {
          action: 'USE_SKILL',
          targetId: null
        };
      }

      return { action: 'WAIT' };
    }

    if (threatType !== 'PROJECTILE_SPAWNED') {
      return { action: 'WAIT' };
    }

    if (responseAction === 'wait') {
      return { action: 'WAIT' };
    }

    const incomingProjectile = snapshot.combat.projectiles.some((projectile) => {
      return projectile.incoming && shouldReactToDistance(projectile.distance);
    });

    if (incomingProjectile && responseAction === 'jump') {
      return {
        action: 'USE_SKILL',
        targetId: null
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
        action: 'DROP',
        itemId: firstItem.id
      };
    }
  }

  if (snapshot.event.type === 'ENCOUNTER_ENEMY') {
    return {
      action: 'ATTACK',
      targetId: snapshot.event.entityId
    };
  }

  return { action: 'WAIT' };
}`;
  }
}

window.StrategyCompiler = StrategyCompiler;
