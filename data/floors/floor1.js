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
          id: 'enemy_001',
          kind: 'enemy',
          type: 'contact_b',
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
            text: 'Door',
            x: 834,
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
          type: 'contact_a',
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
          id: 'door_002',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_003',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'enemy_003',
          kind: 'enemy',
          type: 'melee_a',
          x: 610,
          y: 270,
          label: {
            x: 580,
            y: 330
          }
        }
      ],
      doors: [
        {
          id: 'door_003',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_004',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'enemy_004',
          kind: 'enemy',
          type: 'ranged_a',
          x: 620,
          y: 270,
          label: {
            x: 590,
            y: 330
          }
        }
      ],
      doors: [
        {
          id: 'door_004',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_005',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'enemy_005',
          kind: 'enemy',
          type: 'melee_b',
          x: 640,
          y: 270,
          label: {
            x: 610,
            y: 330
          }
        }
      ],
      doors: [
        {
          id: 'door_005',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_006',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'enemy_006',
          kind: 'enemy',
          type: 'ranged_b',
          x: 660,
          y: 270,
          label: {
            x: 630,
            y: 330
          }
        }
      ],
      doors: [
        {
          id: 'door_006',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_007',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'heal_001',
          kind: 'heal_point',
          type: 'supply_heal_point',
          x: 520,
          y: 270,
          width: 48,
          height: 48,
          fillColor: 0x5fbf9a,
          alpha: 0.9,
          cost: 100,
          healRatio: 0.5,
          encounterRadius: 96,
          label: {
            text: 'Heal',
            x: 500,
            y: 330,
            color: '#99ffd8'
          }
        }
      ],
      doors: [
        {
          id: 'door_007',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    },
    {
      id: 'room_008',
      playerStart: {
        x: 180,
        y: 270
      },
      zones: {},
      entities: [
        {
          id: 'boss_001',
          kind: 'enemy',
          type: 'boss_floor1',
          x: 690,
          y: 270,
          label: {
            x: 648,
            y: 338
          }
        },
        {
          id: 'chest_001',
          kind: 'chest',
          type: 'paper_money_chest',
          active: false,
          lockedUntilBossDefeated: true,
          x: 790,
          y: 318,
          width: 46,
          height: 38,
          fillColor: 0xd6a84f,
          gold: 40,
          encounterRadius: 86,
          label: {
            text: 'Chest',
            x: 766,
            y: 366,
            color: '#ffd98a'
          }
        },
        {
          id: 'return_002',
          kind: 'return_point',
          type: 'return_gate',
          active: false,
          lockedUntilBossDefeated: true,
          x: 850,
          y: 270,
          width: 44,
          height: 80,
          fillColor: 0x5fbf9a,
          alpha: 0.85,
          encounterRadius: 36,
          label: {
            text: 'Gate',
            x: 828,
            y: 330,
            color: '#99ffd8'
          }
        }
      ],
      doors: [
        {
          id: 'door_008',
          x: 850,
          y: 270,
          width: 32,
          height: 88,
          fillColor: 0x7f6a4a,
          label: {
            text: 'Door',
            x: 834,
            y: 330,
            color: '#d8c08f'
          }
        }
      ]
    }
  ]
};

globalThis.Floor1Data = Floor1Data;
