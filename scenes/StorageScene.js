class StorageScene extends Phaser.Scene {
  constructor() {
    super('StorageScene');
    this.panel = null;
    this.isTransitioning = false;
    this.handleEscKey = null;
    this.handleRunKey = null;
  }

  create() {
    this.isTransitioning = false;
    StorageSystem.clearInvalidCurrentRuleData();
    this.createPanel();

    this.handleEscKey = () => this.startMenu();
    this.handleRunKey = () => this.startDungeon();
    this.input.keyboard.on('keydown-ESC', this.handleEscKey);
    this.input.keyboard.on('keydown-R', this.handleRunKey);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearKeyboardHandlers();
      this.destroyPanel();
    });
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'game-dom-panel storage-panel';
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
      if (this.input && this.input.keyboard && typeof this.input.keyboard.off === 'function') {
        this.input.keyboard.off('keydown-ESC', this.handleEscKey);
      }
      this.handleEscKey = null;
    }
    if (this.handleRunKey) {
      if (this.input && this.input.keyboard && typeof this.input.keyboard.off === 'function') {
        this.input.keyboard.off('keydown-R', this.handleRunKey);
      }
      this.handleRunKey = null;
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

  startDungeon() {
    this.startSceneSafely('DungeonScene');
  }

  startMenu() {
    this.startSceneSafely('MenuScene');
  }

  startSkills() {
    this.startSceneSafely('SkillConfigScene');
  }

  render() {
    if (!this.panel) {
      return;
    }

    const items = StorageSystem.getItems();
    const equipped = StorageSystem.getEquipped();

    this.panel.innerHTML = `
      <div class="game-dom-header storage-header">
        <div>
          <h1>局外仓库</h1>
          <p>点击仓库装备穿戴，点击装备栏卸下。悬停装备查看详细词条。</p>
        </div>
        <div class="storage-actions">
          <button type="button" data-action="run">开始探索</button>
          <button type="button" data-action="skills">技能配置</button>
          <button type="button" data-action="back">策略编辑器</button>
        </div>
      </div>
      <div class="storage-layout">
        <section class="equipment-board">
          <div class="section-title">装备栏</div>
          <div class="equipment-grid">
            ${EquipmentData.slots.map((slot) => this.renderSlot(slot, equipped[slot.id])).join('')}
          </div>
        </section>
        <section class="storage-list-panel">
          <div class="section-title">仓库装备 · ${items.length}</div>
          <div class="storage-list">
            ${items.length > 0
              ? items.map((item) => this.renderItemRow(item, equipped)).join('')
              : '<div class="empty-state">暂无已鉴定装备</div>'}
          </div>
        </section>
        <section class="character-attributes-panel">
          <div class="section-title">角色属性</div>
          ${this.renderCharacterAttributes(equipped)}
        </section>
      </div>
      <div class="item-tooltip" hidden></div>
      <div class="game-dom-footer">
        <span>ESC 返回策略编辑器 · R 开始探索</span>
      </div>
    `;

    this.bindDomEvents();
  }

  bindDomEvents() {
    this.panel.querySelectorAll('[data-action]').forEach((element) => {
      element.addEventListener('click', () => {
        const action = element.dataset.action;
        if (action === 'run') {
          this.startDungeon();
          return;
        }
        if (action === 'back') {
          this.startMenu();
          return;
        }
        if (action === 'skills') {
          this.startSkills();
          return;
        }
        if (action === 'equip') {
          const result = StorageSystem.equipItem(element.dataset.itemId);
          if (!result.ok) {
            console.warn('[StorageScene] Equip failed:', result.reason, element.dataset.itemId);
          }
          this.render();
          return;
        }
        if (action === 'unequip') {
          StorageSystem.unequipSlot(element.dataset.slot);
          this.render();
          return;
        }
      });
    });

    this.panel.querySelectorAll('[data-tooltip-item]').forEach((element) => {
      element.addEventListener('mouseenter', (event) => this.showTooltip(event, element.dataset.tooltipItem));
      element.addEventListener('mousemove', (event) => this.moveTooltip(event));
      element.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  renderSlot(slot, item) {
    if (!item) {
      return `
        <button type="button" class="equipment-slot is-empty" data-action="noop">
          <span class="slot-name">${this.getSlotName(slot.id)}</span>
          <span class="slot-empty">空</span>
        </button>
      `;
    }

    return `
      <button type="button" class="equipment-slot has-item quality-${item.quality}" data-action="unequip" data-slot="${slot.id}" data-tooltip-item="${item.id}">
        <span class="slot-name">${this.getSlotName(slot.id)}</span>
        <span class="item-name">${this.getQualityName(item.quality)} ${this.getSlotName(item.slot)}</span>
        <span class="item-meta">等级 ${item.itemLevel || 1} · ${this.getAffixCountText(item)}</span>
      </button>
    `;
  }

  renderItemRow(item, equipped) {
    const equippedSlot = this.getEquippedSlot(item, equipped);
    const isEquipped = Boolean(equippedSlot);
    const equippedClass = isEquipped ? ' is-equipped' : '';

    return `
      <button type="button" class="storage-item quality-${item.quality}${equippedClass}" data-action="equip" data-item-id="${item.id}" data-tooltip-item="${item.id}">
        <span class="storage-item-main">
          <span>${this.getQualityName(item.quality)} ${this.getSlotName(item.slot)}</span>
          <span>${isEquipped ? '已装备 · ' : ''}等级 ${item.itemLevel || 1}</span>
        </span>
        <span class="storage-item-sub">${isEquipped ? `已装备：${this.getSlotName(equippedSlot)}` : this.getAffixCountText(item)}</span>
      </button>
    `;
  }

  showTooltip(event, itemId) {
    const tooltip = this.panel.querySelector('.item-tooltip');
    const item = this.findItemById(itemId);
    if (!tooltip || !item) {
      return;
    }
    tooltip.innerHTML = this.renderItemTooltip(item);
    tooltip.hidden = false;
    this.moveTooltip(event);
  }

  moveTooltip(event) {
    const tooltip = this.panel.querySelector('.item-tooltip');
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

  hideTooltip() {
    const tooltip = this.panel && this.panel.querySelector('.item-tooltip');
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.innerHTML = '';
    }
  }

  findItemById(itemId) {
    const items = StorageSystem.getItems();
    const equipped = Object.values(StorageSystem.getEquipped()).filter(Boolean);
    return items.concat(equipped).find((item) => item.id === itemId) || null;
  }

  renderItemTooltip(item) {
    return `
      <div class="tooltip-title quality-text-${item.quality}">${this.getQualityName(item.quality)} ${item.baseName || this.getSlotName(item.slot)}</div>
      <div class="tooltip-meta">物品等级 ${item.itemLevel || 1} · ${item.id}</div>
      ${item.manualDesignRequired ? '<div class="item-warning">橙装为专属设计占位，尚未配置固定传奇效果。</div>' : ''}
      <div class="affix-list">
        ${this.renderBaseStats(item)}
      </div>
      <div class="affix-list">
        ${(item.affixes || []).length > 0
          ? item.affixes.map((affix) => this.renderAffix(affix)).join('')
          : '<div class="empty-state">无随机词条</div>'}
      </div>
    `;
  }

  renderBaseStats(item) {
    const stats = item.baseStats || {};
    const entries = Object.entries(stats);
    if (!item.baseName || entries.length === 0) {
      return '<div class="empty-state">无基底属性</div>';
    }
    return `
      ${entries.map(([stat, value]) => `
        <div class="affix-row base-affix-row">
          <span>${this.getStatName(stat)}</span>
          <span>${this.formatStatValue(stat, value)}</span>
        </div>
      `).join('')}
    `;
  }

  renderAffix(affix) {
    return `
      <div class="affix-row">
        <span>${this.getAffixName(affix)}${affix.epicPromoted ? ' · 紫装晋升' : ''}</span>
        <span>T${affix.tier} ${this.formatValue(affix)}</span>
      </div>
    `;
  }

  renderCharacterAttributes(equipped) {
    const base = this.getBaseAttributes();
    const bonus = this.getEquipmentAttributeBonuses(equipped);
    const rows = [
      ['生命值', base.maxHp, bonus.maxHp, ''],
      ['灵力', base.maxMp, bonus.maxMp, ''],
      ['攻击力', base.attackDamage, bonus.attackDamage, ''],
      ['攻击范围', base.attackRange, bonus.attackRange, ''],
      ['攻击速度', base.attackSpeed, bonus.attackSpeed, '/秒'],
      ['视野半径', base.visionRadius, bonus.visionRadius, ''],
      ['护甲', 0, bonus.armor, ''],
      ['固定减伤', 0, bonus.damageReductionPercent, '%'],
      ['抗性', 0, bonus.resistancePercent, '%'],
      ['暴击率', 0, bonus.critChancePercent, '%'],
      ['暴击伤害', 0, bonus.critDamagePercent, '%'],
      ['移动速度', 0, bonus.moveSpeedPercent, '%'],
      ['生命回复', 0, bonus.hpRegenPerSecond, '/秒'],
      ['生命偷取', 0, bonus.hpLeechPerHit, '/击'],
      ['灵力回复', 0, bonus.mpRegenPerSecond, '/秒'],
      ['技能伤害', 0, bonus.skillDamagePercent, '%'],
      ['技能冷却缩减', 0, bonus.skillCooldownReductionPercent, '%']
    ];

    return `
      <div class="attribute-list">
        ${rows.map(([label, baseValue, bonusValue, unit]) => this.renderAttributeRow(label, baseValue, bonusValue, unit)).join('')}
      </div>
    `;
  }

  renderAttributeRow(label, baseValue, bonusValue, unit) {
    const hasBonus = Math.abs(bonusValue) > 0.0001;
    return `
      <div class="attribute-row">
        <span>${label}</span>
        <strong class="attribute-value">
          <span class="attribute-base">${this.formatAttributeValue(baseValue, unit)}</span>${hasBonus ? `<span class="attribute-bonus">${bonusValue > 0 ? '+' : ''}${this.formatAttributeValue(bonusValue, unit)}</span>` : ''}
        </strong>
      </div>
    `;
  }

  getBaseAttributes() {
    return {
      maxHp: PlayerData.maxHp || 0,
      maxMp: PlayerData.maxMp || 0,
      attackDamage: PlayerData.attackDamage || 0,
      attackRange: PlayerData.attackRange || 0,
      attackCooldownMs: PlayerData.attackCooldownMs || 0,
      attackSpeed: 1000 / Math.max(1, PlayerData.attackCooldownMs || 600),
      visionRadius: 170
    };
  }

  getEquipmentAttributeBonuses(equipped) {
    const bonus = {
      maxHp: 0,
      maxMp: 0,
      attackDamage: 0,
      attackRange: 0,
      attackSpeed: 0,
      visionRadius: 0,
      armor: 0,
      damageReductionPercent: 0,
      resistancePercent: 0,
      critChancePercent: 0,
      critDamagePercent: 0,
      moveSpeedPercent: 0,
      hpRegenPerSecond: 0,
      hpLeechPerHit: 0,
      mpRegenPerSecond: 0,
      skillDamagePercent: 0,
      skillCooldownReductionPercent: 0
    };
    const base = this.getBaseAttributes();

    Object.values(equipped || {}).forEach((item) => {
      if (!item) {
        return;
      }
      this.addStatsToAttributeBonus(bonus, base, item.baseStats || {});
      (item.affixes || []).forEach((affix) => {
        const value = Number(affix.value) || 0;
        this.addStatToAttributeBonus(bonus, base, affix.stat, value);
      });
    });

    return bonus;
  }

  addStatsToAttributeBonus(bonus, base, stats = {}) {
    Object.entries(stats || {}).forEach(([stat, value]) => {
      this.addStatToAttributeBonus(bonus, base, stat, Number(value) || 0);
    });
  }

  addStatToAttributeBonus(bonus, base, stat, value) {
    switch (stat) {
      case 'addedDamage':
        bonus.attackDamage += value;
        break;
      case 'attackDamageMin':
      case 'attackDamageMax':
        bonus.attackDamage += value / 2;
        break;
      case 'maxHpFlat':
        bonus.maxHp += value;
        break;
      case 'maxHpPercent':
        bonus.maxHp += base.maxHp * value;
        break;
      case 'maxMpFlat':
        bonus.maxMp += value;
        break;
      case 'maxMpPercent':
        bonus.maxMp += base.maxMp * value;
        break;
      case 'attackRangePercent':
        bonus.attackRange += base.attackRange * value;
        break;
      case 'attackSpeed':
        bonus.attackSpeed += value;
        break;
      case 'attackSpeedPercent':
        bonus.attackSpeed += base.attackSpeed * value;
        break;
      case 'attackCooldownPercent':
        bonus.attackSpeed += base.attackSpeed * value;
        break;
      case 'visionRadiusPercent':
        bonus.visionRadius += base.visionRadius * value;
        break;
      case 'armor':
        bonus.armor += value;
        break;
      case 'damageReductionPercent':
      case 'resistancePercent':
      case 'critChancePercent':
      case 'critDamagePercent':
      case 'moveSpeedPercent':
      case 'skillDamagePercent':
      case 'skillCooldownReductionPercent':
        bonus[stat] += value * 100;
        break;
      case 'critChanceFlat':
        bonus.critChancePercent += value * 100;
        break;
      case 'hpRegenPerSecond':
      case 'hpLeechPerHit':
      case 'mpRegenPerSecond':
        bonus[stat] += value;
        break;
      default:
        break;
    }
  }

  getEquippedSlot(item, equipped) {
    if (!item || !item.slot) {
      return null;
    }
    const equippedItem = equipped && equipped[item.slot];
    return equippedItem && equippedItem.id === item.id ? item.slot : null;
  }

  getAffixCountText(item) {
    const count = (item.affixes || []).length;
    return count > 0 ? `${count} 词条` : '无词条';
  }

  getAffixName(affix) {
    const names = {
      added_damage: '附加点伤',
      damage_percent: '百分比增伤',
      extra_damage: '额外伤害',
      attack_range: '攻击范围',
      attack_speed: '攻击速度',
      crit_chance_flat: '基础暴击率',
      crit_chance_percent: '暴击率',
      crit_damage: '暴击伤害',
      armor: '护甲',
      damage_reduction: '固定减伤',
      resistance: '抗性',
      max_hp_flat: '最大生命',
      max_hp_percent: '最大生命百分比',
      hp_regen: '生命回复',
      hp_leech: '生命偷取',
      move_speed: '移动速度',
      vision_radius: '视野半径',
      max_mp_flat: '最大灵力',
      max_mp_percent: '最大灵力百分比',
      mp_regen: '灵力回复',
      skill_damage: '技能伤害',
      skill_cooldown: '技能冷却缩减',
      fire_skill_damage: '火焰技能伤害',
      projectile_skill_damage: '投射物技能伤害',
      aoe_skill_damage: 'AOE 技能伤害',
      dot_skill_damage: '持续技能伤害',
      protection_skill_duration: '护体技能持续时间'
    };
    return names[affix.id || affix.type] || affix.name || affix.id || affix.type || '未知词条';
  }

  getStatName(stat) {
    const names = {
      attackDamageMin: '最小攻击',
      attackDamageMax: '最大攻击',
      attackSpeed: '攻击速度',
      attackSpeedPercent: '攻击速度',
      armor: '护甲',
      maxHpFlat: '最大生命',
      maxMpFlat: '最大灵力',
      resistancePercent: '抗性',
      damageReductionPercent: '减伤',
      critChancePercent: '暴击率',
      critDamagePercent: '暴击伤害',
      moveSpeedPercent: '移动速度',
      skillCooldownReductionPercent: '技能冷却缩减'
    };
    return names[stat] || stat;
  }

  formatStatValue(stat, value) {
    const percentStats = new Set([
      'attackSpeedPercent',
      'resistancePercent',
      'damageReductionPercent',
      'critChancePercent',
      'critDamagePercent',
      'moveSpeedPercent',
      'skillCooldownReductionPercent'
    ]);
    if (percentStats.has(stat)) {
      return `+${Math.round((Number(value) || 0) * 100)}%`;
    }
    if (stat === 'attackSpeed') {
      return `+${this.formatNumber(Number(value) || 0)}/秒`;
    }
    return `+${this.formatNumber(Number(value) || 0)}`;
  }

  getSlotName(slot) {
    const names = {
      weapon: '武器',
      helmet: '头盔',
      armor: '护甲',
      gloves: '手套',
      boots: '鞋子',
      amulet: '项链',
      ring_left: '戒指 I',
      ring_right: '戒指 II',
      belt: '腰带'
    };
    return names[slot] || slot || '装备';
  }

  getQualityName(quality) {
    const names = {
      normal: '白装',
      magic: '蓝装',
      rare: '黄装',
      epic: '紫装',
      legendary: '橙装'
    };
    return names[quality] || quality;
  }

  formatValue(affix) {
    const value = Number(affix.value) || 0;
    if (affix.valueType === 'percent' || Math.abs(value) < 1) {
      return `+${Math.round(value * 100)}%`;
    }
    return `+${this.formatNumber(value)}`;
  }

  formatAttributeValue(value, unit) {
    const normalized = Math.abs(value) < 0.0001 ? 0 : value;
    const formatted = this.formatNumber(normalized);
    return `${formatted}${unit || ''}`;
  }

  formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}

globalThis.StorageScene = StorageScene;
