class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.editorElement = null;
  }

  create() {
    this.add.text(48, 42, 'Hell Survival', {
      fontSize: '30px',
      color: '#f2eee2'
    });
    this.add.text(48, 88, 'Edit onEvent(snapshot), then start the run.', {
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
    wrapper.className = 'strategy-editor strategy-editor-code-only';

    const textarea = document.createElement('textarea');
    textarea.spellcheck = false;
    const savedSource = localStorage.getItem('hellSurvival.strategy');
    textarea.value = savedSource && !StrategyCompiler.isDefaultSource(savedSource)
      ? savedSource
      : StrategyCompiler.getDefaultSource();

    const runButton = document.createElement('button');
    runButton.textContent = '运行策略';

    const resetButton = document.createElement('button');
    resetButton.textContent = '恢复默认策略';

    const storageButton = document.createElement('button');
    storageButton.textContent = '局外仓库';

    const skillButton = document.createElement('button');
    skillButton.textContent = '技能配置';

    const actions = document.createElement('div');
    actions.className = 'strategy-actions';
    actions.appendChild(runButton);
    actions.appendChild(resetButton);
    actions.appendChild(storageButton);
    actions.appendChild(skillButton);

    const error = document.createElement('div');
    error.className = 'error';

    runButton.addEventListener('click', () => {
      try {
        const source = textarea.value;
        const strategy = StrategyCompiler.compile(source);
        if (StrategyCompiler.isDefaultSource(source)) {
          window.onEvent = null;
          localStorage.removeItem('hellSurvival.strategy');
        } else {
          window.onEvent = strategy;
          localStorage.setItem('hellSurvival.strategy', source);
        }
        window.hellSurvivalStrategyConfig = StrategyConfig.save(StrategyConfig.getDefault());
        error.textContent = '';
        this.closeEditor();
        this.scene.start('DungeonScene');
      } catch (compileError) {
        error.textContent = compileError.message;
      }
    });

    resetButton.addEventListener('click', () => {
      textarea.value = StrategyCompiler.getDefaultSource();
      window.onEvent = null;
      localStorage.removeItem('hellSurvival.strategy');
      window.hellSurvivalStrategyConfig = StrategyConfig.reset();
      error.textContent = '';
    });

    storageButton.addEventListener('click', () => {
      this.closeEditor();
      this.scene.start('StorageScene');
    });

    skillButton.addEventListener('click', () => {
      this.closeEditor();
      this.scene.start('SkillConfigScene');
    });

    wrapper.appendChild(textarea);
    wrapper.appendChild(actions);
    wrapper.appendChild(error);

    document.body.appendChild(wrapper);
    this.editorElement = wrapper;
  }

  closeEditor() {
    if (this.editorElement) {
      this.editorElement.remove();
      this.editorElement = null;
    }
  }
}

window.MenuScene = MenuScene;
