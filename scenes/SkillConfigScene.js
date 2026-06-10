class SkillConfigScene extends Phaser.Scene {
  constructor() {
    super('SkillConfigScene');
    this.panel = null;
    this.isTransitioning = false;
    this.handleEscKey = null;
    this.handleStorageKey = null;
  }

  create() {
    this.isTransitioning = false;
    this.createPanel();

    this.handleEscKey = () => this.startMenu();
    this.handleStorageKey = () => this.startStorage();
    this.input.keyboard.on('keydown-ESC', this.handleEscKey);
    this.input.keyboard.on('keydown-S', this.handleStorageKey);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearKeyboardHandlers();
      this.destroyPanel();
    });
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'game-dom-panel skill-config-panel';
    document.body.appendChild(this.panel);
    this.render();
  }

  destroyPanel() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  clearKeyboardHandlers() {
    if (this.handleEscKey) {
      this.input.keyboard.off('keydown-ESC', this.handleEscKey);
      this.handleEscKey = null;
    }
    if (this.handleStorageKey) {
      this.input.keyboard.off('keydown-S', this.handleStorageKey);
      this.handleStorageKey = null;
    }
  }

  startSceneSafely(sceneKey) {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;
    if (this.input && this.input.keyboard) {
      this.input.keyboard.enabled = false;
      if (typeof this.input.keyboard.resetKeys === 'function') {
        this.input.keyboard.resetKeys();
      }
    }
    this.clearKeyboardHandlers();
    this.destroyPanel();
    window.setTimeout(() => {
      this.scene.start(sceneKey);
    }, 0);
  }

  startMenu() {
    this.startSceneSafely('MenuScene');
  }

  startStorage() {
    this.startSceneSafely('StorageScene');
  }

  render() {
    if (!this.panel) {
      return;
    }

    const config = StorageSystem.getBuildConfig();
    const activeSkills = globalThis.SkillsData ? SkillsData.activeSkillIds || [] : [];
    const supportSkills = globalThis.SkillsData ? SkillsData.supportSkillIds || [] : [];
    const supportSkillIds = config.supportSkillIds || [];

    this.panel.innerHTML = `
      <div class="game-dom-header storage-header">
        <div>
          <h1>技能配置</h1>
          <p>配置 1 个主动技能和 2 个辅助技能。局内会按当前槽位配置执行。</p>
        </div>
        <div class="storage-actions">
          <button type="button" data-action="storage">局外仓库</button>
          <button type="button" data-action="back">策略编辑器</button>
        </div>
      </div>
      <div class="skill-config-layout">
        ${this.renderSkillSlot({
          label: '主动技能槽',
          selectedSkillId: config.activeSkillId,
          skillIds: activeSkills,
          skillMap: SkillsData.skills,
          action: 'set-active-skill',
          skillType: 'active'
        })}
        ${this.renderSkillSlot({
          label: '辅助技能槽1',
          selectedSkillId: supportSkillIds[0],
          skillIds: supportSkills,
          skillMap: SkillsData.supportSkills,
          action: 'set-support-skill',
          slotIndex: 0,
          skillType: 'support'
        })}
        ${this.renderSkillSlot({
          label: '辅助技能槽2',
          selectedSkillId: supportSkillIds[1],
          skillIds: supportSkills,
          skillMap: SkillsData.supportSkills,
          action: 'set-support-skill',
          slotIndex: 1,
          skillType: 'support'
        })}
      </div>
      <div class="skill-tooltip" hidden></div>
      <div class="game-dom-footer">
        <span>ESC 返回策略编辑器 · S 打开局外仓库</span>
      </div>
    `;

    this.bindDomEvents();
  }

  bindDomEvents() {
    this.panel.querySelectorAll('[data-action]').forEach((element) => {
      element.addEventListener('click', () => this.handleAction(element));
    });

    this.panel.querySelectorAll('[data-tooltip-skill-id]').forEach((element) => {
      element.addEventListener('mouseenter', (event) => this.showSkillTooltip(event, element));
      element.addEventListener('mousemove', (event) => this.moveSkillTooltip(event));
      element.addEventListener('mouseleave', () => this.hideSkillTooltip());
    });
  }

  handleAction(element) {
    const action = element.dataset.action;
    if (action === 'back') {
      this.startMenu();
      return;
    }
    if (action === 'storage') {
      this.startStorage();
      return;
    }
    if (action === 'set-active-skill') {
      const config = StorageSystem.getBuildConfig();
      StorageSystem.saveBuildConfig({
        ...config,
        activeSkillId: element.dataset.skillId
      });
      this.render();
      return;
    }
    if (action === 'set-support-skill') {
      const config = StorageSystem.getBuildConfig();
      const slotIndex = Number(element.dataset.slotIndex) || 0;
      const supportSkillIds = [...(config.supportSkillIds || [])].slice(0, 2);
      const duplicateIndex = supportSkillIds.findIndex((skillId, index) => {
        return index !== slotIndex && skillId === element.dataset.skillId;
      });
      if (duplicateIndex >= 0) {
        supportSkillIds[duplicateIndex] = null;
      }
      supportSkillIds[slotIndex] = element.dataset.skillId;
      StorageSystem.saveBuildConfig({
        ...config,
        supportSkillIds
      });
      this.render();
    }
  }

  renderSkillSlot({ label, selectedSkillId, skillIds, skillMap, action, slotIndex = null, skillType }) {
    const selectedSkill = selectedSkillId ? skillMap[selectedSkillId] : null;
    const slotAttribute = slotIndex === null ? '' : ` data-slot-index="${slotIndex}"`;
    return `
      <section class="skill-config-card">
        <div class="skill-slot">
          <div class="skill-slot-header">
            <span class="skill-slot-label">${label}</span>
            <span class="skill-slot-current">${selectedSkill ? selectedSkill.name : '未配置'}</span>
          </div>
          <div class="skill-choice-list">
            ${skillIds.map((skillId) => {
              const skill = skillMap[skillId];
              const selected = skillId === selectedSkillId;
              return `
                <button type="button" class="skill-choice${selected ? ' is-selected' : ''}" data-action="${action}" data-skill-id="${skillId}" data-tooltip-skill-id="${skillId}" data-tooltip-skill-type="${skillType}"${slotAttribute}>
                  <span>${skill ? skill.name : skillId}</span>
                  <span class="skill-choice-tags">${skill ? this.getSkillMeta(skill) : ''}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  showSkillTooltip(event, element) {
    const tooltip = this.panel.querySelector('.skill-tooltip');
    if (!tooltip) {
      return;
    }
    const skillId = element.dataset.tooltipSkillId;
    const skillType = element.dataset.tooltipSkillType;
    const skillMap = skillType === 'support' ? SkillsData.supportSkills : SkillsData.skills;
    const skill = skillMap ? skillMap[skillId] : null;
    if (!skill) {
      return;
    }

    tooltip.innerHTML = this.renderSkillTooltip(skill);
    tooltip.hidden = false;
    this.moveSkillTooltip(event);
  }

  moveSkillTooltip(event) {
    const tooltip = this.panel.querySelector('.skill-tooltip');
    if (!tooltip || tooltip.hidden) {
      return;
    }

    const panelRect = this.panel.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const offset = 14;
    const maxLeft = panelRect.width - tooltipRect.width - 10;
    const maxTop = panelRect.height - tooltipRect.height - 10;
    const left = Math.min(Math.max(10, event.clientX - panelRect.left + offset), Math.max(10, maxLeft));
    const top = Math.min(Math.max(10, event.clientY - panelRect.top + offset), Math.max(10, maxTop));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  hideSkillTooltip() {
    const tooltip = this.panel && this.panel.querySelector('.skill-tooltip');
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.innerHTML = '';
    }
  }

  renderSkillTooltip(skill) {
    return `
      <div class="tooltip-title">${skill.name}</div>
      <div class="tooltip-meta">${this.getSkillMeta(skill)}</div>
      <div class="skill-tooltip-tags">
        ${(skill.tags || []).map((tag) => `<span>${this.getTagName(tag)}</span>`).join('')}
      </div>
      <div class="skill-tooltip-description">${skill.description || this.getSkillDescription(skill)}</div>
    `;
  }

  getSkillMeta(skill) {
    const tags = (skill.tags || []).map((tag) => this.getTagName(tag)).join(' / ');
    const mp = skill.mpCost ? `MP ${skill.mpCost}` : '';
    const cooldown = skill.cooldownMs ? `${(skill.cooldownMs / 1000).toFixed(0)}s` : '';
    return [tags, mp, cooldown].filter(Boolean).join(' · ');
  }

  getTagName(tag) {
    const names = {
      fire: '火',
      water: '水',
      wood: '木',
      metal: '金',
      earth: '土',
      yin_yang: '阴阳',
      projectile: '投射物',
      aoe: '范围',
      dot: '持续伤害',
      curse: '诅咒',
      skill: '技能',
      support: '辅助',
      protection: '防护',
      movement: '移动',
      continuous: '持续',
      melee: '近战'
    };
    return names[tag] || tag;
  }

  getSkillDescription(skill) {
    if (skill.damageMultiplier) {
      return `释放后对目标造成 ${skill.damageMultiplier} 倍技能伤害。${skill.range ? `有效距离 ${skill.range}。` : ''}`;
    }
    if (skill.damagePerTick) {
      return `在身边形成持续区域，每 ${((skill.tickMs || 1000) / 1000).toFixed(1)} 秒造成 ${skill.damagePerTick} 点伤害，持续 ${((skill.durationMs || 0) / 1000).toFixed(0)} 秒。`;
    }
    if (skill.reflectPercent) {
      return `进入防护状态，持续 ${((skill.durationMs || 0) / 1000).toFixed(0)} 秒，受到攻击时按比例反伤。`;
    }
    if (skill.mpOnKill) {
      return `击败敌人后回复 ${skill.mpOnKill} 点灵力。`;
    }
    if (skill.absorbMaxHpRatio) {
      return `危险时触发护盾，吸收相当于最大生命 ${Math.round(skill.absorbMaxHpRatio * 100)}% 的伤害。`;
    }
    if (skill.moveSpeedPercent) {
      return `提高移动速度 ${Math.round(skill.moveSpeedPercent * 100)}%。`;
    }
    if (skill.requiredHits) {
      return `连续命中同一目标 ${skill.requiredHits} 次后，下次命中获得额外暴击机会。`;
    }
    if (skill.normalAttackDamagePercentWhileTakingDot) {
      return `受到持续伤害影响时，普通攻击伤害提高 ${Math.round(skill.normalAttackDamagePercentWhileTakingDot * 100)}%。`;
    }
    if (skill.normalAttackLeechPercent) {
      return `普通攻击按伤害的 ${Math.round(skill.normalAttackLeechPercent * 100)}% 回复生命。`;
    }
    if (skill.damageReductionPercent) {
      return `受到伤害降低 ${Math.round(skill.damageReductionPercent * 100)}%。`;
    }
    if (skill.nextAttackDamagePercent) {
      return `触发后下一次普通攻击伤害提高 ${Math.round(skill.nextAttackDamagePercent * 100)}%。`;
    }
    return '暂无说明。';
  }
}

window.SkillConfigScene = SkillConfigScene;
