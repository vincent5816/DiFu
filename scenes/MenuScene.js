class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.editorElement = null;
  }

  create() {
    this.add.text(48, 42, '地府生存指下', {
      fontSize: '30px',
      color: '#f2eee2'
    });
    this.add.text(48, 88, '编辑 onEvent(snapshot)，或用下方规则配置角色的自动反应。', {
      fontSize: '16px',
      color: '#c9c1b1'
    });

    this.createStrategyEditor();
  }

  shutdown() {
    if (this.editorElement) {
      this.editorElement.remove();
      this.editorElement = null;
    }
  }

  createStrategyEditor() {
    const wrapper = document.createElement('div');
    wrapper.className = 'strategy-editor';

    const savedConfig = StrategyConfig.load();
    const ruleInputs = {};

    const configPanel = document.createElement('div');
    configPanel.className = 'strategy-config';

    const hpThresholdInput = this.createNumberInput('HP 阈值', savedConfig.hpLowThreshold, 0.05, 0.95, 0.05);
    configPanel.appendChild(this.createConfigGroup('基础', [hpThresholdInput.label]));

    StrategyConfig.getEnemyTypes().forEach((enemyType) => {
      const fields = [];
      ruleInputs[enemyType] = {};

      StrategyConfig.getSupportedEventsForEnemy(enemyType).forEach((eventType) => {
        const rule = savedConfig.combatRules[enemyType][eventType];
        const eventInput = this.createCombatRuleInput(enemyType, eventType, rule);
        ruleInputs[enemyType][eventType] = eventInput;
        fields.push(eventInput.row);
      });

      configPanel.appendChild(this.createConfigGroup(StrategyConfig.getEnemyDisplayName(enemyType), fields));
    });

    const textarea = document.createElement('textarea');
    textarea.spellcheck = false;
    textarea.value = localStorage.getItem('hellSurvival.strategy') || StrategyCompiler.getDefaultSource();

    const button = document.createElement('button');
    button.textContent = '运行策略';

    const resetButton = document.createElement('button');
    resetButton.textContent = '恢复默认策略';

    const actions = document.createElement('div');
    actions.className = 'strategy-actions';
    actions.appendChild(button);
    actions.appendChild(resetButton);

    const error = document.createElement('div');
    error.className = 'error';

    button.addEventListener('click', () => {
      try {
        window.onEvent = StrategyCompiler.compile(textarea.value);
        localStorage.setItem('hellSurvival.strategy', textarea.value);
        window.hellSurvivalStrategyConfig = StrategyConfig.save(this.createConfigFromInputs({
          hpThresholdInput,
          ruleInputs
        }));
        error.textContent = '';
        this.editorElement.remove();
        this.editorElement = null;
        this.scene.start('DungeonScene');
      } catch (compileError) {
        error.textContent = compileError.message;
      }
    });

    resetButton.addEventListener('click', () => {
      textarea.value = StrategyCompiler.getDefaultSource();
      localStorage.setItem('hellSurvival.strategy', textarea.value);
      const defaults = StrategyConfig.reset();
      hpThresholdInput.input.value = defaults.hpLowThreshold;
      this.applyConfigToRuleInputs(ruleInputs, defaults);
      window.hellSurvivalStrategyConfig = defaults;
      error.textContent = '';
    });

    wrapper.appendChild(configPanel);
    wrapper.appendChild(textarea);
    wrapper.appendChild(actions);
    wrapper.appendChild(error);

    document.body.appendChild(wrapper);
    this.editorElement = wrapper;
  }

  createCombatRuleInput(enemyType, eventType, rule) {
    const row = document.createElement('div');
    row.className = 'strategy-rule-row';

    const eventName = document.createElement('div');
    eventName.className = 'strategy-rule-event';
    eventName.textContent = StrategyConfig.getEventDisplayName(eventType);

    const actionInput = this.createSelectInput('响应方式', rule.responseAction, StrategyConfig.getActionOptions(eventType));
    const delayInput = this.createNumberInput('响应延迟(ms)', rule.delayMs, 0, 2000, 50);
    const distanceInput = eventType === 'PROJECTILE_SPAWNED'
      ? this.createSelectInput('躲避距离', rule.distance, [
        ['near', 'near'],
        ['mid', 'mid'],
        ['far', 'far']
      ])
      : null;

    row.appendChild(eventName);
    row.appendChild(actionInput.label);
    row.appendChild(delayInput.label);
    if (distanceInput) {
      row.appendChild(distanceInput.label);
    }

    return {
      enemyType,
      eventType,
      row,
      actionInput,
      delayInput,
      distanceInput
    };
  }

  createConfigFromInputs(inputs) {
    const combatRules = {};
    Object.entries(inputs.ruleInputs).forEach(([enemyType, eventInputs]) => {
      combatRules[enemyType] = {};
      Object.entries(eventInputs).forEach(([eventType, eventInput]) => {
        combatRules[enemyType][eventType] = {
          responseAction: eventInput.actionInput.input.value,
          delayMs: Number(eventInput.delayInput.input.value)
        };
        if (eventInput.distanceInput) {
          combatRules[enemyType][eventType].distance = eventInput.distanceInput.input.value;
        }
      });
    });

    const archerProjectileRule = combatRules.skeleton_archer && combatRules.skeleton_archer.PROJECTILE_SPAWNED;
    const guardWindupRule = combatRules.skeleton_guard && combatRules.skeleton_guard.ENEMY_WINDUP;

    return {
      hpLowThreshold: Number(inputs.hpThresholdInput.input.value),
      dodgeProjectileDistance: archerProjectileRule ? archerProjectileRule.distance : 'near',
      windupResponseEnabled: guardWindupRule ? guardWindupRule.responseAction !== 'wait' : false,
      windupResponseAction: guardWindupRule ? guardWindupRule.responseAction : 'wait',
      windupReactionDelayMs: guardWindupRule ? guardWindupRule.delayMs : 0,
      projectileResponseEnabled: archerProjectileRule ? archerProjectileRule.responseAction !== 'wait' : false,
      projectileReactionDelayMs: archerProjectileRule ? archerProjectileRule.delayMs : 0,
      combatRules
    };
  }

  applyConfigToRuleInputs(ruleInputs, config) {
    Object.entries(ruleInputs).forEach(([enemyType, eventInputs]) => {
      Object.entries(eventInputs).forEach(([eventType, eventInput]) => {
        const rule = config.combatRules[enemyType] && config.combatRules[enemyType][eventType];
        if (!rule) {
          return;
        }

        eventInput.actionInput.input.value = rule.responseAction;
        eventInput.delayInput.input.value = rule.delayMs;
        if (eventInput.distanceInput) {
          eventInput.distanceInput.input.value = rule.distance || 'near';
        }
      });
    });
  }

  createNumberInput(text, value, min, max, step) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    label.textContent = text;
    label.appendChild(input);
    return { label, input };
  }

  createConfigGroup(title, fields) {
    const group = document.createElement('div');
    group.className = 'strategy-config-group';

    const heading = document.createElement('div');
    heading.className = 'strategy-config-title';
    heading.textContent = title;

    const fieldList = document.createElement('div');
    fieldList.className = 'strategy-config-fields';
    fields.forEach((field) => fieldList.appendChild(field));

    group.appendChild(heading);
    group.appendChild(fieldList);
    return group;
  }

  createSelectInput(text, value, options) {
    const label = document.createElement('label');
    const input = document.createElement('select');
    options.forEach(([optionValue, optionText]) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionText;
      input.appendChild(option);
    });
    input.value = value;
    label.textContent = text;
    label.appendChild(input);
    return { label, input };
  }
}

window.MenuScene = MenuScene;
