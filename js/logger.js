import { CONFIG } from "./config.js";

export class Logger {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.frames = [];
    this.events = [];
  }

  recordFrame(frame) {
    this.frames.push(frame);
    const keepAfter = frame.t - Math.max(CONFIG.eventPreMs * 4, 30000);
    while (this.frames.length && this.frames[0].t < keepAfter) {
      this.frames.shift();
    }
  }

  markHit(label = "hit") {
    const t = performance.now();
    const event = {
      t,
      type: label,
      window: this.frames.filter((frame) => Math.abs(frame.t - t) <= CONFIG.eventPreMs)
    };
    this.events.push(event);
    return event;
  }

  toJson() {
    return {
      startedAt: this.startedAt,
      exportedAt: new Date().toISOString(),
      config: { ...CONFIG },
      frames: this.frames,
      events: this.events
    };
  }

  toCsv() {
    const rows = [
      ["t", "state", "guideCount", "tracked", "weak", "lost", "tipDelta", "shapeDelta", "score", "candidate", "userMark", "guides"]
    ];

    for (const frame of this.frames) {
      rows.push([
        frame.t.toFixed(2),
        frame.state,
        frame.guides.length,
        frame.tracked,
        frame.weak,
        frame.lost,
        frame.tipDelta.toFixed(5),
        frame.shapeDelta.toFixed(5),
        frame.score.toFixed(5),
        frame.candidate ? "1" : "0",
        frame.userMark || "",
        JSON.stringify(frame.guides)
      ]);
    }

    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }
}

export function downloadText(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
