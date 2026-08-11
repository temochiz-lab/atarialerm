import { CONFIG } from "./config.js";

const COLORS = {
  registered: "#59b7ff",
  tracked: "#35d186",
  weak: "#e2c84f",
  lost: "#ff5c66",
  recovered: "#78f0b3"
};

export function drawOverlay(canvas, guides, options = {}) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (CONFIG.overlay.polyline && guides.length > 1) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = options.candidate ? "#ff5c66" : "#59b7ff";
    ctx.beginPath();
    ctx.moveTo(guides[0].x, guides[0].y);
    for (let i = 1; i < guides.length; i += 1) {
      ctx.lineTo(guides[i].x, guides[i].y);
    }
    ctx.stroke();
  }

  for (const guide of guides) {
    const color = COLORS[guide.status] || COLORS.registered;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = guide.status === "lost" ? 4 : 2;

    if (CONFIG.overlay.boxes) {
      const size = options.roiSize || CONFIG.roiSize;
      ctx.strokeRect(guide.x - size / 2, guide.y - size / 2, size, size);
    }

    ctx.beginPath();
    ctx.arc(guide.x, guide.y, 4, 0, Math.PI * 2);
    ctx.fill();

    if (CONFIG.overlay.labels) {
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.fillText(guide.status === "lost" ? `${guide.id} ロスト` : guide.id, guide.x + 10, guide.y - 10);
    }
  }
}

export function drawSignal(canvas, values) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#07110d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#2f4138";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (canvas.height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  if (!values.length) return;

  ctx.strokeStyle = "#35d186";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const start = Math.max(0, values.length - 160);
  for (let i = start; i < values.length; i += 1) {
    const x = ((i - start) / Math.max(1, values.length - start - 1)) * canvas.width;
    const y = canvas.height - Math.min(1, values[i]) * canvas.height;
    if (i === start) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
