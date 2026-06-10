class AgentRunner {
  constructor(options = {}) {
    this.strategyName = options.strategyName || 'onEvent';
  }

  run(snapshot) {
    const systemCommand = this.getSystemCommand(snapshot);
    if (systemCommand) {
      return this.annotateCommand(systemCommand, 'system');
    }

    const externalAgent = this.getExternalAgent();
    if (externalAgent) {
      const command = this.runStrategy(externalAgent, snapshot, 'external agent');
      if (command) {
        const bossOverride = this.getBossDefendOverride(snapshot, command);
        if (bossOverride) {
          return this.annotateCommand(bossOverride, 'boss_safety');
        }
        const defendOverride = this.getEncounterDefendOverride(snapshot, command);
        if (defendOverride) {
          return this.annotateCommand(defendOverride, 'defend_safety');
        }
        return this.annotateCommand(command, 'external');
      }
    }

    const strategy = window[this.strategyName];

    if (typeof strategy === 'function' && !this.isBuiltInDefaultStrategy(strategy)) {
      const command = this.runStrategy(strategy, snapshot, this.strategyName);
      if (command) {
        const bossOverride = this.getBossDefendOverride(snapshot, command);
        if (bossOverride) {
          return this.annotateCommand(bossOverride, 'boss_safety');
        }
        const defendOverride = this.getEncounterDefendOverride(snapshot, command);
        if (defendOverride) {
          return this.annotateCommand(defendOverride, 'defend_safety');
        }
        return this.annotateCommand(command, 'user');
      }
    }

    const defaultBossCommand = this.getDefaultBossCommand(snapshot);
    if (defaultBossCommand) {
      return this.annotateCommand(defaultBossCommand, 'built_in_boss');
    }

    const defaultEnemyCommand = this.getDefaultEnemyCommand(snapshot);
    if (defaultEnemyCommand) {
      return this.annotateCommand(defaultEnemyCommand, 'built_in_enemy');
    }

    const configuredCommand = this.getConfiguredCombatCommand(snapshot);
    if (configuredCommand) {
      return this.annotateCommand(configuredCommand, 'config');
    }

    return this.annotateCommand(this.getMetaCommand(snapshot), 'meta');
  }

  getSystemCommand(snapshot) {
    if (!snapshot || !snapshot.event) {
      return null;
    }

    switch (snapshot.event.type) {
      case 'STATE_NEW_ROOM':
      case 'ENCOUNTER_CHEST':
      case 'ENCOUNTER_LOOT':
      case 'ENCOUNTER_PAPER_MONEY':
      case 'ENCOUNTER_HEAL_POINT':
      case 'ENCOUNTER_RETURN_POINT':
      case 'STATE_BAG_FULL':
        return this.getMetaCommand(snapshot);
      default:
        return null;
    }
  }

  annotateCommand(command, source) {
    if (!command || typeof command !== 'object') {
      return command;
    }

    if (Array.isArray(command)) {
      return command.map((entry) => this.annotateCommand(entry, source));
    }

    const annotated = { ...command, agentSource: source };
    if (Array.isArray(annotated.actions)) {
      annotated.actions = annotated.actions.map((entry) => this.annotateCommand(entry, source));
    }
    if (Array.isArray(annotated.commands)) {
      annotated.commands = annotated.commands.map((entry) => this.annotateCommand(entry, source));
    }
    if (annotated.command && typeof annotated.command === 'object') {
      annotated.command = this.annotateCommand(annotated.command, source);
    }
    return annotated;
  }

  isBuiltInDefaultStrategy(strategy) {
    return window.StrategyCompiler &&
      typeof window.StrategyCompiler.isDefaultStrategy === 'function' &&
      window.StrategyCompiler.isDefaultStrategy(strategy);
  }

  getBossDefendOverride(snapshot, command) {
    if (!snapshot || !snapshot.event || snapshot.event.type !== 'ENCOUNTER_ENEMY') {
      return null;
    }

    if (!command || Array.isArray(command) || Array.isArray(command.actions) || Array.isArray(command.commands)) {
      return null;
    }

    if (command.action !== 'DEFEND') {
      return null;
    }

    const boss = this.findNearestVisionEntity(snapshot, ['boss']) ||
      this.findNearestKnownEntity(snapshot, ['boss']);
    if (!boss || boss.id !== snapshot.event.entityId || !boss.inAttackRange) {
      return null;
    }

    if (snapshot.player && snapshot.player.attackCooldownRemainingMs > 0) {
      return null;
    }

    return { action: 'ATTACK', targetId: boss.id, method: 'normal' };
  }

  getEncounterDefendOverride(snapshot, command) {
    if (!snapshot || !snapshot.event || snapshot.event.type !== 'ENCOUNTER_ENEMY') {
      return null;
    }

    if (!command || Array.isArray(command) || Array.isArray(command.actions) || Array.isArray(command.commands)) {
      return null;
    }

    if (command.action !== 'DEFEND') {
      return null;
    }

    const target = this.findEncounterTarget(snapshot);
    if (!target || target.id !== snapshot.event.entityId) {
      return null;
    }

    const activeSkill = snapshot.player && snapshot.player.skills
      ? snapshot.player.skills.activeSkill
      : null;
    if (
      activeSkill &&
      activeSkill.ready &&
      snapshot.player.mp >= (activeSkill.mpCost || 0)
    ) {
      return { action: 'SKILL', targetId: target.id, skillId: activeSkill.id };
    }

    if (
      target.inAttackRange &&
      snapshot.player &&
      snapshot.player.attackCooldownRemainingMs <= 0
    ) {
      return { action: 'ATTACK', targetId: target.id, method: 'normal' };
    }

    if (snapshot.player && snapshot.player.isDefending) {
      const direction = this.getHorizontalDirection(target.direction);
      if (direction) {
        return { action: 'MOVE', direction, durationMs: 260, targetId: target.id, stopAtAttackRange: true };
      }
      return { action: 'WAIT' };
    }

    return null;
  }

  findEncounterTarget(snapshot) {
    const entityId = snapshot && snapshot.event ? snapshot.event.entityId : null;
    if (!entityId) {
      return null;
    }

    const visible = Array.isArray(snapshot.vision)
      ? snapshot.vision.find((entity) => entity.id === entityId)
      : null;
    if (visible) {
      return visible;
    }

    return Array.isArray(snapshot.knownEnemies)
      ? snapshot.knownEnemies.find((entity) => entity.id === entityId) || null
      : null;
  }

  getDefaultBossCommand(snapshot) {
    const boss = this.findNearestVisionEntity(snapshot, ['boss']) ||
      this.findNearestKnownEntity(snapshot, ['boss']);
    if (!boss) {
      return null;
    }

    const attackRange = boss.attackRange ||
      (snapshot.player && snapshot.player.attackRange) ||
      0;
    const attackDistance = boss.attackDistance;
    const isTooClose = attackDistance !== null &&
      attackDistance !== undefined &&
      attackDistance <= Math.max(10, attackRange * 0.12);

    if (isTooClose) {
      const retreatDirection = this.getOppositeHorizontalDirection(boss.direction);
      if (retreatDirection) {
        return { action: 'MOVE', direction: retreatDirection, durationMs: 180 };
      }
    }

    if (boss.inAttackRange && snapshot.player && snapshot.player.attackCooldownRemainingMs > 0) {
      return this.getBossCooldownFootworkCommand(boss, attackRange);
    }

    if (boss.inAttackRange) {
      return { action: 'ATTACK', targetId: boss.id, method: 'normal' };
    }

    if (boss.direction && boss.direction.includes('left')) {
      return { action: 'MOVE', direction: 'left', durationMs: 900, targetId: boss.id, stopAtAttackRange: true };
    }

    if (boss.direction && boss.direction.includes('right')) {
      return { action: 'MOVE', direction: 'right', durationMs: 900, targetId: boss.id, stopAtAttackRange: true };
    }

    return { action: 'ATTACK', targetId: boss.id, method: 'normal' };
  }

  getDefaultEnemyCommand(snapshot) {
    if (!this.isEnemyCombatEvent(snapshot)) {
      return null;
    }

    const enemy = this.findNearestVisionEntity(snapshot, ['contact_', 'melee_', 'ranged_']) ||
      this.findNearestKnownEntity(snapshot, ['contact_', 'melee_', 'ranged_']);
    if (!enemy) {
      return null;
    }

    if (enemy.inAttackRange) {
      if (snapshot.player && snapshot.player.attackCooldownRemainingMs > 0) {
        return this.getEnemyCooldownFootworkCommand(enemy, snapshot.player.attackRange || enemy.attackRange || 0);
      }

      return { action: 'ATTACK', targetId: enemy.id, method: 'normal' };
    }

    const direction = this.getHorizontalDirection(enemy.direction);
    if (direction) {
      return { action: 'MOVE', direction, durationMs: 900, targetId: enemy.id, stopAtAttackRange: true };
    }

    return { action: 'ATTACK', targetId: enemy.id, method: 'normal' };
  }

  isEnemyCombatEvent(snapshot) {
    if (!snapshot || !snapshot.event) {
      return false;
    }

    return snapshot.event.type === 'ENCOUNTER_ENEMY' ||
      snapshot.event.type === 'STATE_COMBAT_THREAT' ||
      snapshot.event.type === 'STATE_HP_LOW';
  }

  getBossCooldownFootworkCommand(boss, attackRange) {
    const attackDistance = boss.attackDistance;
    if (attackDistance === null || attackDistance === undefined) {
      return { action: 'WAIT' };
    }

    const towardDirection = this.getHorizontalDirection(boss.direction);
    const awayDirection = this.getOppositeHorizontalDirection(boss.direction);
    const nearBand = attackRange * 0.45;
    const farBand = attackRange * 0.8;

    if (attackDistance < nearBand && awayDirection) {
      return { action: 'MOVE', direction: awayDirection, durationMs: 140 };
    }

    if (attackDistance > farBand && towardDirection) {
      return { action: 'MOVE', direction: towardDirection, durationMs: 160 };
    }

    return { action: 'WAIT' };
  }

  getEnemyCooldownFootworkCommand(enemy, attackRange) {
    const attackDistance = enemy.attackDistance;
    if (attackDistance === null || attackDistance === undefined) {
      return { action: 'WAIT' };
    }

    const enemyType = String(enemy.type || '');
    const shouldKeepSpace = enemyType.startsWith('melee_') || enemyType.startsWith('contact_');
    if (!shouldKeepSpace) {
      return { action: 'WAIT' };
    }

    const towardDirection = this.getHorizontalDirection(enemy.direction);
    const awayDirection = this.getOppositeHorizontalDirection(enemy.direction);
    const nearBand = attackRange * 0.55;
    const farBand = attackRange * 0.88;

    if (attackDistance < nearBand && awayDirection) {
      return { action: 'MOVE', direction: awayDirection, durationMs: 150 };
    }

    if (attackDistance > farBand && towardDirection) {
      return { action: 'MOVE', direction: towardDirection, durationMs: 140, targetId: enemy.id, stopAtAttackRange: true };
    }

    return { action: 'WAIT' };
  }

  getHorizontalDirection(direction) {
    if (!direction) {
      return null;
    }

    if (direction.includes('left')) {
      return 'left';
    }

    if (direction.includes('right')) {
      return 'right';
    }

    return null;
  }

  getOppositeHorizontalDirection(direction) {
    if (!direction) {
      return null;
    }

    if (direction.includes('left')) {
      return 'right';
    }

    if (direction.includes('right')) {
      return 'left';
    }

    return null;
  }

  getExternalAgent() {
    const agent = window.DiFuAgent || window.HellSurvivalAgent || null;
    if (!agent) {
      return null;
    }

    if (typeof agent === 'function') {
      return agent;
    }

    if (typeof agent.onEvent === 'function') {
      return agent.onEvent.bind(agent);
    }

    if (typeof agent.decide === 'function') {
      return agent.decide.bind(agent);
    }

    return null;
  }

  runStrategy(strategy, snapshot, label) {
    try {
      const command = strategy(snapshot);
      if (!this.isCommandResult(command)) {
        console.warn(`[AgentRunner] ${label} returned invalid command.`, command);
        return null;
      }
      return command;
    } catch (error) {
      console.warn(`[AgentRunner] ${label} error.`, error);
      return null;
    }
  }

  isCommandResult(command) {
    if (!command || typeof command !== 'object') {
      return false;
    }

    if (Array.isArray(command)) {
      return command.length > 0;
    }

    if (Array.isArray(command.actions) || Array.isArray(command.commands)) {
      return true;
    }

    return typeof command.action === 'string';
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
      return { action: 'JUMP' };
    }

    if (rule.responseAction === 'attack') {
      return { action: 'ATTACK', targetId: snapshot.event.entityId, method: 'normal' };
    }

    return { action: 'WAIT' };
  }

  getMetaCommand(snapshot) {
    const eventType = snapshot && snapshot.event ? snapshot.event.type : null;
    const entityId = snapshot && snapshot.event ? snapshot.event.entityId : null;
    const nearestEnemy = this.findNearestVisionEntity(snapshot, ['enemy', 'boss']);
    const nearestHealPoint = this.findNearestVisionEntity(snapshot, ['supply_heal_point']);

    switch (eventType) {
      case 'ENCOUNTER_ENEMY':
        return { action: 'ATTACK', targetId: entityId || (nearestEnemy && nearestEnemy.id) };
      case 'ENCOUNTER_TRAP':
        return { action: 'MOVE', direction: 'right' };
      case 'ENCOUNTER_CHEST':
        return { action: 'OPEN', targetId: entityId };
      case 'ENCOUNTER_HEAL_POINT':
        return { action: 'USE', targetId: entityId };
      case 'ENCOUNTER_LOOT':
        return { action: 'PICKUP', targetId: entityId };
      case 'ENCOUNTER_PAPER_MONEY':
        return { action: 'PICKUP', targetId: entityId };
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
            return { action: 'JUMP' };
          }
          return { action: 'WAIT' };
        }
        if (
          snapshot.event.details &&
          snapshot.event.details.threatType === 'PROJECTILE_SPAWNED' &&
          this.shouldRespondToProjectile(snapshot)
        ) {
          return { action: 'JUMP' };
        }
        return { action: 'WAIT' };
      case 'STATE_NEW_ROOM':
        return { action: 'MOVE', direction: 'right' };
      case 'STATE_BAG_FULL':
        return this.getBagFullCommand(snapshot);
      case 'STATE_HP_LOW':
        if (nearestHealPoint && nearestHealPoint.distance === 'near') {
          return { action: 'USE', targetId: nearestHealPoint.id };
        }
        return { action: 'MOVE', direction: 'right' };
      case 'STATE_MP_THRESHOLD':
      case 'STATE_GOLD_THRESHOLD':
      case 'STATE_BUFF_EXPIRED':
      default:
        return { action: 'WAIT' };
    }
  }

  getBagFullCommand(snapshot) {
    const items = snapshot &&
      snapshot.player &&
      snapshot.player.bag &&
      Array.isArray(snapshot.player.bag.items)
      ? snapshot.player.bag.items
      : [];
    const item = items
      .slice()
      .sort((a, b) => {
        const qualityDiff = this.getEquipmentQualityRank(a.quality) - this.getEquipmentQualityRank(b.quality);
        if (qualityDiff !== 0) {
          return qualityDiff;
        }
        return String(a.id).localeCompare(String(b.id));
      })[0];
    return item
      ? { action: 'DISCARD', itemId: item.id }
      : { action: 'WAIT' };
  }

  getEquipmentQualityRank(quality) {
    const ranks = {
      normal: 1,
      magic: 2,
      rare: 3,
      epic: 4,
      legendary: 5
    };
    return ranks[quality] || 0;
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

  findNearestKnownEntity(snapshot, kinds) {
    if (!snapshot || !Array.isArray(snapshot.knownEnemies)) {
      return null;
    }

    return snapshot.knownEnemies.find((entity) => {
      return kinds.some((kind) => entity.type.includes(kind));
    }) || null;
  }
}

window.AgentRunner = AgentRunner;
