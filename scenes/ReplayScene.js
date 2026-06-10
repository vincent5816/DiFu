class ReplayScene extends Phaser.Scene {
  constructor() {
    super('ReplayScene');
    this.summary = null;
    this.page = 0;
    this.pageSize = 13;
    this.eventTexts = [];
    this.pageText = null;
  }

  init(data) {
    this.summary = data || null;
    this.page = 0;
  }

  create() {
    const summary = this.summary || {
      result: 'unknown',
      events: []
    };

    this.add.text(48, 42, '开发者事件复盘', {
      fontSize: '30px',
      color: '#f2eee2'
    });

    this.add.text(48, 92, `结果：${this.getResultLabel(summary.result)}    事件数：${summary.events.length}`, {
      fontSize: '16px',
      color: '#d8d0c0'
    });

    this.pageText = this.add.text(48, 470, '', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.add.text(48, 500, '按 ← / → 翻页，按 ESC 返回策略编辑器', {
      fontSize: '14px',
      color: '#8f887b'
    });

    this.input.keyboard.on('keydown-LEFT', () => {
      this.changePage(-1);
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.changePage(1);
    });
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });

    this.renderPage();
  }

  changePage(delta) {
    const summary = this.getSummary();
    const maxPage = Math.max(0, Math.ceil(summary.events.length / this.pageSize) - 1);
    this.page = Phaser.Math.Clamp(this.page + delta, 0, maxPage);
    this.renderPage();
  }

  renderPage() {
    const summary = this.getSummary();
    this.eventTexts.forEach((text) => text.destroy());
    this.eventTexts = [];

    if (summary.events.length === 0) {
      this.eventTexts.push(this.add.text(48, 140, '暂无事件', {
        fontSize: '16px',
        color: '#8f887b'
      }));
      this.pageText.setText('第 1/1 页');
      return;
    }

    const start = this.page * this.pageSize;
    const events = summary.events.slice(start, start + this.pageSize);

    events.forEach((event, index) => {
      const y = 136 + index * 28;
      this.eventTexts.push(this.add.text(
        48,
        y,
        ReplayFormatter.formatEvent(event),
        {
          fontSize: '14px',
          color: event.type === 'COMMAND_EXECUTED' ? '#99ffd8' : '#d8d0c0'
        }
      ));
    });

    const maxPage = Math.max(1, Math.ceil(summary.events.length / this.pageSize));
    this.pageText.setText(`第 ${this.page + 1}/${maxPage} 页   显示 ${start + 1}-${start + events.length}`);
  }

  getSummary() {
    return this.summary || {
      result: 'unknown',
      events: []
    };
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
}

window.ReplayScene = ReplayScene;
