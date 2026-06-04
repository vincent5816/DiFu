class ReturnScene extends Phaser.Scene {
  constructor() {
    super('ReturnScene');
    this.summary = null;
    this.identifiedItems = [];
    this.hasIdentified = false;
    this.panel = null;
    this.identifyText = null;
  }

  init(data) {
    this.summary = data || null;
  }

  create() {
    const summary = this.getSummary();
    this.createPanel(summary);

    this.input.keyboard.on('keydown-R', () => {
      this.scene.start('DungeonScene');
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
    this.input.keyboard.on('keydown-C', () => {
      this.scene.start('CodexScene');
    });
    this.input.keyboard.on('keydown-P', () => {
      this.scene.start('ReplayScene', summary);
    });
    this.input.keyboard.on('keydown-I', () => {
      this.identifyReturnedItems(summary);
    });
    this.input.keyboard.on('keydown-S', () => {
      this.scene.start('StorageScene');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyPanel());
  }

  getSummary() {
    return this.summary || {
      result: 'unknown',
      floor: 1,
      roomId: 'unknown',
      hp: 0,
      maxHp: 0,
      gold: 0,
      bag: {
        slots: 0,
        used: 0,
        items: []
      },
      lostItems: [],
      newCodexEntries: [],
      events: [],
      agentReplayIndex: '',
      developerRunLog: ''
    };
  }

  createPanel(summary) {
    this.panel = document.createElement('div');
    this.panel.className = 'game-dom-panel return-panel';
    this.panel.innerHTML = `
      <div class="game-dom-header">
        <h1>返回结算</h1>
        <p class="${summary.result === 'death' ? 'danger' : 'success'}">结果：${this.getResultLabel(summary.result)}</p>
      </div>
      <div class="return-grid">
        <section>
          <h2>本局结果</h2>
          <div class="summary-line">层级：第 ${summary.floor} 层 / 房间：${summary.roomId}</div>
          <div class="summary-line">HP：${summary.hp}/${summary.maxHp} · 纸钱：${summary.gold}</div>
          <h2>带回未鉴定装备：${summary.bag.used}/${summary.bag.slots}</h2>
          ${this.renderItems(summary.bag.items)}
          ${this.renderLostItems(summary.lostItems || [])}
          <h2>本局新解锁图鉴：${summary.newCodexEntries.length}</h2>
          ${this.renderCodexEntries(summary.newCodexEntries)}
        </section>
        <section>
          <h2>关键事件：${summary.events.length}</h2>
          ${this.renderEvents(summary.events.slice(0, 10))}
          ${this.renderAgentReplayIndex(summary.agentReplayIndex)}
          ${this.renderDeveloperRunLog(summary.developerRunLog)}
        </section>
      </div>
      <div class="identify-line">按 I 鉴定并入库带回装备</div>
      <div class="game-dom-footer">
        <span>按 R 再来一局，按 I 鉴定，按 S 查看仓库，按 P 查看复盘，按 C 查看图鉴，按 ESC 返回策略编辑器</span>
      </div>
    `;
    document.body.appendChild(this.panel);
    this.identifyText = this.panel.querySelector('.identify-line');
    this.panel.querySelectorAll('[data-copy-target]').forEach((button) => {
      button.addEventListener('click', () => this.copyTextArea(button.dataset.copyTarget));
    });
  }

  destroyPanel() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.identifyText = null;
    }
  }

  renderItems(items) {
    if (!items || items.length === 0) {
      return '<div class="muted">无</div>';
    }

    return `<div class="item-list">${items.map((item) => {
      return `<div style="color:${this.getQualityColor(item.quality)}">${item.id} · 品质边框：${item.quality}</div>`;
    }).join('')}</div>`;
  }

  renderLostItems(items) {
    if (!items || items.length === 0) {
      return '';
    }

    return `
      <h2 class="danger">死亡损失：${items.length} 件</h2>
      <div class="item-list">${items.map((item) => {
        return `<div style="color:${this.getQualityColor(item.quality)}">${item.id} · 品质边框：${item.quality}</div>`;
      }).join('')}</div>
    `;
  }

  renderCodexEntries(entries) {
    if (!entries || entries.length === 0) {
      return '<div class="muted">无</div>';
    }

    return `<div class="item-list">${entries.map((entry) => `<div>${entry.type}</div>`).join('')}</div>`;
  }

  renderEvents(events) {
    if (!events || events.length === 0) {
      return '<div class="muted">暂无事件</div>';
    }

    return `<div class="event-list">${events.map((event) => {
      return `<div>${event.time}ms · ${ReplayFormatter.getEventLabel(event.type)} · ${ReplayFormatter.formatDetailsPreview(event.details)}</div>`;
    }).join('')}</div>`;
  }

  renderAgentReplayIndex(agentReplayIndex) {
    if (!agentReplayIndex) {
      return '';
    }

    return this.renderCopyBlock({
      title: '给 Agent 的经历素材',
      className: 'agent-replay-index',
      content: agentReplayIndex,
      buttonLabel: '复制给 Agent',
      hint: '不是调试日志。复制给 agent，让它用同伴口吻讲给玩家听。',
      height: 260,
      background: '#17161d'
    });
  }

  renderDeveloperRunLog(developerRunLog) {
    if (!developerRunLog) {
      return '';
    }

    return this.renderCopyBlock({
      title: '开发者完整局内日志',
      className: 'developer-run-log',
      content: developerRunLog,
      buttonLabel: '复制完整日志',
      hint: '完整 JSON，不截断 events，用于排查游戏逻辑。',
      height: 300,
      background: '#101015'
    });
  }

  renderCopyBlock(options) {
    return `
      <h2>${options.title}</h2>
      <textarea class="${options.className}" readonly style="width:100%;height:${options.height}px;resize:vertical;background:${options.background};color:#f2eee2;border:1px solid #6f6758;padding:10px;font:12px/1.5 monospace;">${this.escapeHtml(options.content)}</textarea>
      <div class="copy-actions" style="display:flex;align-items:center;gap:10px;margin-top:8px;">
        <button type="button" data-copy-target=".${options.className}">${options.buttonLabel}</button>
        <span class="copy-status muted">${options.hint}</span>
      </div>
    `;
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  copyTextArea(selector) {
    const textarea = this.panel && this.panel.querySelector(selector);
    if (!textarea) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textarea.value)
        .then(() => this.setCopyStatus(textarea, '已复制'))
        .catch(() => this.copyTextAreaFallback(textarea));
      return;
    }

    this.copyTextAreaFallback(textarea);
  }

  copyTextAreaFallback(textarea) {
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand('copy');
      this.setCopyStatus(textarea, success ? '已复制' : '复制失败，请手动复制');
    } catch (error) {
      this.setCopyStatus(textarea, '复制失败，请手动复制');
    }
  }

  setCopyStatus(textarea, message) {
    const block = textarea.nextElementSibling;
    const status = block && block.querySelector('.copy-status');
    if (status) {
      status.textContent = message;
    }
  }

  getQualityColor(quality) {
    const colors = {
      normal: '#c9c1b1',
      magic: '#8b6dff',
      rare: '#69c0ff',
      epic: '#c77dff',
      legendary: '#ffb347'
    };

    return colors[quality] || '#f2eee2';
  }

  getResultLabel(result) {
    if (result === 'retreat') {
      return '主动返回';
    }
    if (result === 'death') {
      return '死亡';
    }
    return result;
  }

  identifyReturnedItems(summary) {
    if (this.hasIdentified) {
      this.identifyText.textContent = `已鉴定 ${this.identifiedItems.length} 件装备`;
      return;
    }

    this.identifiedItems = StorageSystem.identifyAndStore(summary.bag.items);
    this.hasIdentified = true;
    this.identifyText.textContent = `已鉴定 ${this.identifiedItems.length} 件装备，并放入局外仓库`;
  }
}

window.ReturnScene = ReturnScene;
