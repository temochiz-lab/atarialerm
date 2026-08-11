export class GuideRegistry {
  constructor() {
    this.guides = [];
  }

  add(point) {
    const guide = {
      id: `G${this.guides.length + 1}`,
      x: point.x,
      y: point.y,
      status: "registered",
      featureCount: 0
    };
    this.guides.push(guide);
    return guide;
  }

  undo() {
    this.guides.pop();
  }

  clear() {
    this.guides = [];
  }

  snapshot() {
    return this.guides.map((guide) => ({ ...guide }));
  }

  replace(guides) {
    this.guides = guides.map((guide, index) => ({
      ...guide,
      id: `G${index + 1}`
    }));
  }
}
