class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.on('loaderror', (file) => {
      const watchedKeys = ['player_role', 'boss_floor1_sprite', 'contact_a_sprite', 'contact_b_sprite', 'melee_a_sprite', 'melee_b_sprite', 'ranged_a_sprite', 'ranged_b_sprite', 'room_background_1_3', 'room_background_2_1', 'room_background_3_2', 'room_background_4_6', 'room_background_5_5', 'room_background_6_1', 'room_background_7_2', 'room_background_8_3'];
      if (file && watchedKeys.includes(file.key)) {
        const source = file.src || file.url || '';
        console.warn(`[BootScene] Failed to load ${file.key} image:`, String(source).startsWith('data:') ? 'data URI' : source || file);
      }
    });
    const playerRoleSource = window.PlayerRoleSprite && window.PlayerRoleSprite.dataUri
      ? window.PlayerRoleSprite.dataUri
      : './image/player-role-3-clean.png';
    const bossFloor1Source = window.MonsterSprites &&
      window.MonsterSprites.boss_floor1 &&
      window.MonsterSprites.boss_floor1.dataUri
      ? window.MonsterSprites.boss_floor1.dataUri
      : './image/m-1-1-clean.png';
    const contactASource = window.MonsterSprites &&
      window.MonsterSprites.contact_a &&
      window.MonsterSprites.contact_a.dataUri
      ? window.MonsterSprites.contact_a.dataUri
      : './image/m-prd-1-clean.png';
    const contactBSource = window.MonsterSprites &&
      window.MonsterSprites.contact_b &&
      window.MonsterSprites.contact_b.dataUri
      ? window.MonsterSprites.contact_b.dataUri
      : './image/m-shishan-1-clean.png';
    const meleeASource = window.MonsterSprites &&
      window.MonsterSprites.melee_a &&
      window.MonsterSprites.melee_a.dataUri
      ? window.MonsterSprites.melee_a.dataUri
      : './image/m-jixiao-1-clean.png';
    const meleeBSource = window.MonsterSprites &&
      window.MonsterSprites.melee_b &&
      window.MonsterSprites.melee_b.dataUri
      ? window.MonsterSprites.melee_b.dataUri
      : './image/m-nianzhong-1-clean.png';
    const rangedASource = window.MonsterSprites &&
      window.MonsterSprites.ranged_a &&
      window.MonsterSprites.ranged_a.dataUri
      ? window.MonsterSprites.ranged_a.dataUri
      : './image/m-feishu-1-clean.png';
    const rangedBSource = window.MonsterSprites &&
      window.MonsterSprites.ranged_b &&
      window.MonsterSprites.ranged_b.dataUri
      ? window.MonsterSprites.ranged_b.dataUri
      : './image/m-feishu-2-clean.png';
    const roomBackground13Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_1_3 &&
      window.RoomBackgroundSprites.background_1_3.dataUri
      ? window.RoomBackgroundSprites.background_1_3.dataUri
      : './image/bg-1-3.png';
    const roomBackground21Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_2_1 &&
      window.RoomBackgroundSprites.background_2_1.dataUri
      ? window.RoomBackgroundSprites.background_2_1.dataUri
      : './image/bg-2-1.png';
    const roomBackground32Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_3_2 &&
      window.RoomBackgroundSprites.background_3_2.dataUri
      ? window.RoomBackgroundSprites.background_3_2.dataUri
      : './image/bg-3-2.png';
    const roomBackground46Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_4_6 &&
      window.RoomBackgroundSprites.background_4_6.dataUri
      ? window.RoomBackgroundSprites.background_4_6.dataUri
      : './image/bg-4-6.png';
    const roomBackground55Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_5_5 &&
      window.RoomBackgroundSprites.background_5_5.dataUri
      ? window.RoomBackgroundSprites.background_5_5.dataUri
      : './image/bg-5-5.png';
    const roomBackground61Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_6_1 &&
      window.RoomBackgroundSprites.background_6_1.dataUri
      ? window.RoomBackgroundSprites.background_6_1.dataUri
      : './image/bg-6-1.png';
    const roomBackground72Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_7_2 &&
      window.RoomBackgroundSprites.background_7_2.dataUri
      ? window.RoomBackgroundSprites.background_7_2.dataUri
      : './image/bg-7-2.png';
    const roomBackground83Source = window.RoomBackgroundSprites &&
      window.RoomBackgroundSprites.background_8_3 &&
      window.RoomBackgroundSprites.background_8_3.dataUri
      ? window.RoomBackgroundSprites.background_8_3.dataUri
      : './image/bg-8-3.png';
    this.load.image('player_role', playerRoleSource);
    this.load.image('boss_floor1_sprite', bossFloor1Source);
    this.load.image('contact_a_sprite', contactASource);
    this.load.image('contact_b_sprite', contactBSource);
    this.load.image('melee_a_sprite', meleeASource);
    this.load.image('melee_b_sprite', meleeBSource);
    this.load.image('ranged_a_sprite', rangedASource);
    this.load.image('ranged_b_sprite', rangedBSource);
    this.load.image('room_background_1_3', roomBackground13Source);
    this.load.image('room_background_2_1', roomBackground21Source);
    this.load.image('room_background_3_2', roomBackground32Source);
    this.load.image('room_background_4_6', roomBackground46Source);
    this.load.image('room_background_5_5', roomBackground55Source);
    this.load.image('room_background_6_1', roomBackground61Source);
    this.load.image('room_background_7_2', roomBackground72Source);
    this.load.image('room_background_8_3', roomBackground83Source);
  }

  create() {
    this.scene.start('MenuScene');
  }
}

window.BootScene = BootScene;
