class StrategyConfig {
  static getStorageKey() {
    return 'hellSurvival.strategyConfig';
  }

  static getDefault() {
    return {
      hpLowThreshold: 0.3,
      dodgeProjectileDistance: 'near',
      windupResponseEnabled: false,
      windupResponseAction: 'wait',
      windupReactionDelayMs: 500,
      projectileResponseEnabled: true,
      projectileReactionDelayMs: 100,
      combatRules: {
        skeleton_archer: {
          ENEMY_WINDUP: {
            responseAction: 'wait',
            delayMs: 500
          },
          ENEMY_COOLDOWN: {
            responseAction: 'wait',
            delayMs: 0
          },
          PROJECTILE_SPAWNED: {
            responseAction: 'jump',
            delayMs: 100,
            distance: 'near'
          }
        },
        skeleton_guard: {
          ENEMY_WINDUP: {
            responseAction: 'move_left',
            delayMs: 500
          },
          ENEMY_COOLDOWN: {
            responseAction: 'attack',
            delayMs: 0
          }
        }
      }
    };
  }

  static getEnemyTypes() {
    const defaultTypes = Object.keys(StrategyConfig.getDefault().combatRules);
    const dataTypes = globalThis.EnemyData ? Object.keys(globalThis.EnemyData) : [];
    return Array.from(new Set([...defaultTypes, ...dataTypes]));
  }

  static getSupportedEventsForEnemy(enemyType) {
    const enemy = globalThis.EnemyData && globalThis.EnemyData[enemyType];
    const events = ['ENEMY_WINDUP', 'ENEMY_COOLDOWN'];
    if (enemy && enemy.combat && enemy.combat.attackType === 'ranged') {
      events.push('PROJECTILE_SPAWNED');
    }
    return events;
  }

  static getEnemyDisplayName(enemyType) {
    const names = {
      skeleton_archer: '远程怪',
      skeleton_guard: '近战怪'
    };
    return names[enemyType] || enemyType;
  }

  static getEventDisplayName(eventType) {
    const names = {
      ENEMY_WINDUP: '前摇',
      ENEMY_COOLDOWN: '冷却',
      PROJECTILE_SPAWNED: '投射物生成'
    };
    return names[eventType] || eventType;
  }

  static getActionOptions(eventType) {
    if (eventType === 'ENEMY_COOLDOWN') {
      return [
        ['attack', '攻击'],
        ['move_right', '靠近'],
        ['wait', '不响应']
      ];
    }

    if (eventType === 'PROJECTILE_SPAWNED') {
      return [
        ['jump', '跳跃'],
        ['wait', '不响应']
      ];
    }

    return [
      ['wait', '不响应'],
      ['move_left', '后撤'],
      ['jump', '跳跃']
    ];
  }

  static load() {
    try {
      const saved = JSON.parse(localStorage.getItem(StrategyConfig.getStorageKey()) || '{}');
      return StrategyConfig.normalize({
        ...StrategyConfig.getDefault(),
        ...saved
      });
    } catch (error) {
      console.warn('[StrategyConfig] Failed to load saved config, using defaults.', error);
      return StrategyConfig.getDefault();
    }
  }

  static save(config) {
    const normalized = StrategyConfig.normalize(config);
    localStorage.setItem(StrategyConfig.getStorageKey(), JSON.stringify(normalized));
    return normalized;
  }

  static reset() {
    const defaults = StrategyConfig.getDefault();
    localStorage.setItem(StrategyConfig.getStorageKey(), JSON.stringify(defaults));
    return defaults;
  }

  static normalize(config) {
    const defaults = StrategyConfig.getDefault();
    const hpLowThreshold = Number(config.hpLowThreshold);
    const legacyReactionDelayMs = config.reactionDelayMs ?? config.dodgeWindupMs;
    const windupReactionDelayMs = Number(config.windupReactionDelayMs ?? legacyReactionDelayMs);
    const projectileReactionDelayMs = Number(config.projectileReactionDelayMs);
    const allowedDistances = ['near', 'mid', 'far'];
    const allowedWindupActions = ['wait', 'move_left', 'jump'];
    const legacyWindupAction = config.windupResponseEnabled ? 'move_left' : 'wait';
    const windupResponseAction = config.windupResponseAction || legacyWindupAction;

    const normalized = {
      hpLowThreshold: Number.isFinite(hpLowThreshold)
        ? Phaser.Math.Clamp(hpLowThreshold, 0.05, 0.95)
        : defaults.hpLowThreshold,
      dodgeProjectileDistance: allowedDistances.includes(config.dodgeProjectileDistance)
        ? config.dodgeProjectileDistance
        : defaults.dodgeProjectileDistance,
      windupResponseEnabled: config.windupResponseEnabled === undefined
        ? windupResponseAction !== 'wait'
        : Boolean(config.windupResponseEnabled),
      windupResponseAction: allowedWindupActions.includes(windupResponseAction)
        ? windupResponseAction
        : defaults.windupResponseAction,
      windupReactionDelayMs: Number.isFinite(windupReactionDelayMs)
        ? Phaser.Math.Clamp(Math.round(windupReactionDelayMs), 0, 2000)
        : defaults.windupReactionDelayMs,
      projectileResponseEnabled: config.projectileResponseEnabled === undefined
        ? defaults.projectileResponseEnabled
        : Boolean(config.projectileResponseEnabled),
      projectileReactionDelayMs: Number.isFinite(projectileReactionDelayMs)
        ? Phaser.Math.Clamp(Math.round(projectileReactionDelayMs), 0, 2000)
        : defaults.projectileReactionDelayMs
    };
    normalized.combatRules = StrategyConfig.normalizeCombatRules(config.combatRules, config.enemyRules, normalized);
    normalized.enemyRules = StrategyConfig.createLegacyEnemyRules(normalized.combatRules);
    return normalized;
  }

  static normalizeCombatRules(combatRules, legacyEnemyRules, fallback) {
    const defaults = StrategyConfig.getDefault().combatRules;
    const sourceRules = combatRules || StrategyConfig.convertLegacyEnemyRules(legacyEnemyRules, fallback) || defaults;
    const normalized = {};
    StrategyConfig.getEnemyTypes().forEach((type) => {
      const rulesByEvent = sourceRules[type] || {};
      normalized[type] = {};
      StrategyConfig.getSupportedEventsForEnemy(type).forEach((eventType) => {
        normalized[type][eventType] = StrategyConfig.normalizeCombatRule(
          rulesByEvent[eventType],
          defaults[type] && defaults[type][eventType],
          fallback
        );
      });
    });
    return normalized;
  }

  static normalizeCombatRule(rule = {}, defaultRule = {}, fallback) {
    const allowedActions = ['wait', 'move_left', 'move_right', 'jump', 'attack'];
    const allowedDistances = ['near', 'mid', 'far'];
    const delayMs = Number(rule.delayMs);

    return {
      responseAction: allowedActions.includes(rule.responseAction)
        ? rule.responseAction
        : (defaultRule.responseAction || 'wait'),
      delayMs: Number.isFinite(delayMs)
        ? Phaser.Math.Clamp(Math.round(delayMs), 0, 2000)
        : (defaultRule.delayMs || fallback.windupReactionDelayMs || 0),
      distance: allowedDistances.includes(rule.distance)
        ? rule.distance
        : (defaultRule.distance || fallback.dodgeProjectileDistance || 'near')
    };
  }

  static convertLegacyEnemyRules(enemyRules, fallback) {
    if (!enemyRules) {
      return null;
    }

    const converted = {};
    Object.entries(enemyRules).forEach(([type, rule]) => {
      converted[type] = {
        ENEMY_WINDUP: {
          responseAction: rule.windupResponseAction || fallback.windupResponseAction,
          delayMs: fallback.windupReactionDelayMs
        },
        PROJECTILE_SPAWNED: {
          responseAction: rule.projectileResponseEnabled === false ? 'wait' : 'jump',
          delayMs: fallback.projectileReactionDelayMs,
          distance: fallback.dodgeProjectileDistance
        }
      };
    });
    return converted;
  }

  static createLegacyEnemyRules(combatRules) {
    const legacy = {};
    Object.entries(combatRules || {}).forEach(([type, rules]) => {
      legacy[type] = {
        windupResponseAction: rules.ENEMY_WINDUP ? rules.ENEMY_WINDUP.responseAction : 'wait',
        projectileResponseEnabled: rules.PROJECTILE_SPAWNED
          ? rules.PROJECTILE_SPAWNED.responseAction !== 'wait'
          : false
      };
    });
    return legacy;
  }

  static getCombatRule(config, sourceType, eventType) {
    const normalized = StrategyConfig.normalize(config || StrategyConfig.getDefault());
    const byEnemy = normalized.combatRules[sourceType];
    return byEnemy && byEnemy[eventType] ? byEnemy[eventType] : null;
  }
}

window.StrategyConfig = StrategyConfig;
