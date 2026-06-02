class AgentRunner {
  constructor(options = {}) {
    this.strategyName = options.strategyName || 'onEvent';
  }

  run(snapshot) {
    const configuredCommand = this.getConfiguredCombatCommand(snapshot);
    if (configuredCommand) {
      return configuredCommand;
    }

    const strategy = window[this.strategyName];

    if (typeof strategy !== 'function') {
      return this.getMetaCommand(snapshot);
    }

    try {
      const command = strategy(snapshot);
      if (!command || typeof command !== 'object') {
        console.warn('[AgentRunner] Strategy returned invalid command, using meta strategy.', command);
        return this.getMetaCommand(snapshot);
      }
      return command;
    } catch (error) {
      console.warn('[AgentRunner] Strategy error, using meta strategy.', error);
      return this.getMetaCommand(snapshot);
    }
  }

  getConfiguredCombatCommand(snapshot) {
    if (!snapshot || !snapshot.event || snapshot.event.type !== 'STATE_COMBAT_THREAT') {
      return null;
    }

    const details = snapshot.event.details || {};
    const rule = StrategyConfig.getCombatRule(snapshot.strategyConfig, details.sourceType, details.threatType);
    if (!rule || rule.responseAction === 'wait') {
      return { action: 'WAIT' };
    }

    if (rule.responseAction === 'move_left') {
      return { action: 'MOVE', direction: 'left' };
    }

    if (rule.responseAction === 'move_right') {
      return { action: 'MOVE', direction: 'right' };
    }

    if (rule.responseAction === 'jump') {
      return { action: 'USE_SKILL', targetId: null };
    }

    if (rule.responseAction === 'attack') {
      return { action: 'ATTACK', targetId: snapshot.event.entityId };
    }

    return { action: 'WAIT' };
  }

  getMetaCommand(snapshot) {
    const eventType = snapshot && snapshot.event ? snapshot.event.type : null;
    const entityId = snapshot && snapshot.event ? snapshot.event.entityId : null;
    const nearestEnemy = this.findNearestVisionEntity(snapshot, ['enemy', 'boss']);

    switch (eventType) {
      case 'ENCOUNTER_ENEMY':
        return { action: 'ATTACK', targetId: entityId || (nearestEnemy && nearestEnemy.id) };
      case 'ENCOUNTER_TRAP':
        return { action: 'MOVE', direction: 'right' };
      case 'ENCOUNTER_CHEST':
        return { action: 'OPEN', targetId: entityId };
      case 'ENCOUNTER_CROSSROAD':
        return { action: 'MOVE', direction: Phaser.Utils.Array.GetRandom(['left', 'right', 'up', 'down']) };
      case 'ENCOUNTER_RETURN_POINT':
        return { action: 'RETREAT' };
      case 'ENCOUNTER_BOSS':
        return { action: 'ATTACK', targetId: entityId || (nearestEnemy && nearestEnemy.id) };
      case 'STATE_COMBAT_THREAT':
        if (snapshot.event.details && snapshot.event.details.threatType === 'ENEMY_WINDUP') {
          const sourceType = snapshot.event.details.sourceType;
          const rule = snapshot.strategyConfig &&
            snapshot.strategyConfig.enemyRules &&
            snapshot.strategyConfig.enemyRules[sourceType];
          const action = (rule && rule.windupResponseAction) ||
            (snapshot.strategyConfig && snapshot.strategyConfig.windupResponseAction);
          if (action === 'move_left') {
            return { action: 'MOVE', direction: 'left' };
          }
          if (action === 'jump') {
            return { action: 'USE_SKILL', targetId: null };
          }
          return { action: 'WAIT' };
        }
        if (
          snapshot.event.details &&
          snapshot.event.details.threatType === 'PROJECTILE_SPAWNED' &&
          this.shouldRespondToProjectile(snapshot)
        ) {
          return { action: 'USE_SKILL', targetId: null };
        }
        return { action: 'WAIT' };
      case 'STATE_NEW_ROOM':
        return { action: 'MOVE', direction: 'right' };
      case 'STATE_BAG_FULL':
      case 'STATE_HP_LOW':
      case 'STATE_MP_THRESHOLD':
      case 'STATE_GOLD_THRESHOLD':
      case 'STATE_BUFF_EXPIRED':
      default:
        return { action: 'WAIT' };
    }
  }

  shouldRespondToProjectile(snapshot) {
    if (!snapshot.strategyConfig) {
      return true;
    }

    const sourceType = snapshot.event.details.sourceType;
    const rule = snapshot.strategyConfig.enemyRules && snapshot.strategyConfig.enemyRules[sourceType];
    if (rule && rule.projectileResponseEnabled !== undefined) {
      return rule.projectileResponseEnabled;
    }

    return snapshot.strategyConfig.projectileResponseEnabled !== false;
  }

  findNearestVisionEntity(snapshot, kinds) {
    if (!snapshot || !Array.isArray(snapshot.vision)) {
      return null;
    }

    return snapshot.vision.find((entity) => {
      return kinds.some((kind) => entity.type.includes(kind));
    }) || null;
  }
}

window.AgentRunner = AgentRunner;
