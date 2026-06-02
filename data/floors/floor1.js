const Floor1Data = {
  roomFrame: {
    x: 480,
    y: 270,
    width: 860,
    height: 390,
    fillColor: 0x222129,
    borderColor: 0x6a6255
  },
  rooms: [
    {
      id: 'room_001',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'chest_001',
          kind: 'chest',
          type: 'paper_money_chest',
          x: 520,
          y: 270,
          width: 46,
          height: 38,
          fillColor: 0xd6a84f,
          gold: 40,
          label: {
            text: '宝箱',
            x: 496,
            y: 330,
            color: '#ffd98a'
          }
        },
        {
          id: 'enemy_001',
          kind: 'enemy',
          type: 'skeleton_archer',
          x: 620,
          y: 270,
          label: {
            x: 592,
            y: 330
          }
        }
      ],
      doors: [
        {
          id: 'door_001',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: '门',
            x: 842,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_002',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'enemy_002',
          kind: 'enemy',
          type: 'skeleton_guard',
          x: 620,
          y: 270,
          label: {
            x: 592,
            y: 330
          }
        },
        {
          id: 'return_001',
          kind: 'return_point',
          type: 'return_gate',
          x: 850,
          y: 270,
          width: 44,
          height: 80,
          fillColor: 0x5fbf9a,
          alpha: 0.85,
          encounterRadius: 36,
          label: {
            text: '返回点',
            x: 822,
            y: 330,
            color: '#99ffd8'
          }
        }
      ]
    }
  ]
};

globalThis.Floor1Data = Floor1Data;
