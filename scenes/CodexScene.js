class CodexScene extends Phaser.Scene {
  constructor() {
    super('CodexScene');
    this.page = 0;
    this.pageSize = 3;
    this.panel = null;
    this.entriesRoot = null;
    this.pageText = null;
  }

  create() {
    this.entries = ProgressSystem.listCodexEntries()
      .sort((a, b) => a.type.localeCompare(b.type));
    this.page = 0;
    this.createPanel();
    this.renderPage();

    this.input.keyboard.on('keydown-LEFT', () => this.changePage(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.changePage(1));
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyPanel());
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'game-dom-panel';
    this.panel.innerHTML = `
      <div class="game-dom-header">
        <h1>图鉴</h1>
        <p>这里只记录已遭遇怪物的公开事件。具体应对由玩家脚本决定。</p>
      </div>
      <div class="codex-entries"></div>
      <div class="game-dom-footer">
        <span class="codex-page"></span>
        <span>按 ← / → 翻页，按 ESC 返回策略编辑器</span>
      </div>
    `;
    document.body.appendChild(this.panel);
    this.entriesRoot = this.panel.querySelector('.codex-entries');
    this.pageText = this.panel.querySelector('.codex-page');
  }

  destroyPanel() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.entriesRoot = null;
      this.pageText = null;
    }
  }

  changePage(delta) {
    const maxPage = Math.max(0, Math.ceil(this.entries.length / this.pageSize) - 1);
    this.page = Phaser.Math.Clamp(this.page + delta, 0, maxPage);
    this.renderPage();
  }

  renderPage() {
    this.entriesRoot.innerHTML = '';

    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = '尚未解锁任何条目';
      this.entriesRoot.appendChild(empty);
      this.pageText.textContent = '第 1/1 页';
      return;
    }

    const start = this.page * this.pageSize;
    const pageEntries = this.entries.slice(start, start + this.pageSize);
    pageEntries.forEach((entry) => this.entriesRoot.appendChild(this.createEntryNode(entry)));

    const maxPage = Math.max(1, Math.ceil(this.entries.length / this.pageSize));
    this.pageText.textContent = `第 ${this.page + 1}/${maxPage} 页  显示 ${start + 1}-${start + pageEntries.length}`;
  }

  createEntryNode(entry) {
    const enemy = globalThis.EnemyData && globalThis.EnemyData[entry.type];
    const combat = enemy && enemy.combat ? enemy.combat : null;
    const node = document.createElement('section');
    node.className = 'codex-entry';
    node.innerHTML = `
      <h2>${StrategyConfig.getEnemyDisplayName(entry.type)}</h2>
      <div class="meta">类型：${this.getAttackTypeLabel(combat && combat.attackType)} · 初见：${this.formatDate(entry.unlockedAt)}</div>
      <div>已观察事件：${this.getObservedEventLabels(entry).join('、') || '暂无'}</div>
    `;
    return node;
  }

  getObservedEventLabels(entry) {
    const observedEvents = entry.observedEvents || {};
    return Object.values(observedEvents)
      .sort((a, b) => a.type.localeCompare(b.type))
      .map((event) => {
        const countText = `已观察 ${event.count} 次`;
        const burstText = event.burstCount ? `，${event.burstCount}连发` : '';
        return `${StrategyConfig.getEventDisplayName(event.type)}（${countText}${burstText}）`;
      });
  }

  getAttackTypeLabel(type) {
    const labels = {
      charge: '冲锋',
      contact: '接触',
      melee: '近战',
      ranged: '远程'
    };
    return labels[type] || '-';
  }

  formatDate(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('zh-CN', {
      hour12: false
    });
  }
}

window.CodexScene = CodexScene;
