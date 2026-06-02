class RunRecorder {
  constructor(scene) {
    this.scene = scene;
    this.events = [];
  }

  record(type, details = {}) {
    this.events.push({
      time: Math.round(this.scene.time.now),
      type,
      floor: this.scene.currentFloor,
      roomId: this.scene.currentRoomId,
      details
    });
  }

  getSnapshot() {
    return this.events.map((event) => ({
      time: event.time,
      type: event.type,
      floor: event.floor,
      roomId: event.roomId,
      details: event.details
    }));
  }
}

globalThis.RunRecorder = RunRecorder;
