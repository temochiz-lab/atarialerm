import { CONFIG } from "./config.js";
import { startCamera } from "./camera.js";
import { syncCanvasToVideo, eventToVideoPoint } from "./coords.js";
import { GuideRegistry } from "./guide-register.js";
import { loadOpenCv } from "./opencv-loader.js";
import { GuideTracker } from "./tracker.js";
import { normalizeGuides } from "./normalize.js";
import { Metrics } from "./metrics.js";
import { BiteDetector } from "./detector.js";
import { Logger, downloadText } from "./logger.js";
import { AlertAudio } from "./audio.js";
import { drawOverlay, drawSignal } from "./overlay.js";

const State = {
  IDLE: "IDLE",
  CAMERA_READY: "CAMERA_READY",
  REGISTERING: "REGISTERING",
  READY_TO_TRACK: "READY_TO_TRACK",
  TRACKING: "TRACKING"
};

const ui = {
  video: document.querySelector("#videoInput"),
  overlay: document.querySelector("#overlay"),
  stage: document.querySelector("#stage"),
  biteFlash: document.querySelector("#biteFlash"),
  signal: document.querySelector("#signalCanvas"),
  stateText: document.querySelector("#stateText"),
  trackingText: document.querySelector("#trackingText"),
  scoreText: document.querySelector("#scoreText"),
  opencvText: document.querySelector("#opencvText"),
  messageText: document.querySelector("#messageText"),
  cameraButton: document.querySelector("#cameraButton"),
  registerButton: document.querySelector("#registerButton"),
  undoButton: document.querySelector("#undoButton"),
  clearButton: document.querySelector("#clearButton"),
  doneButton: document.querySelector("#doneButton"),
  trackingButton: document.querySelector("#trackingButton"),
  markButton: document.querySelector("#markButton"),
  resetButton: document.querySelector("#resetButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  sensitivityInput: document.querySelector("#sensitivityInput"),
  sensitivityText: document.querySelector("#sensitivityText")
};

const registry = new GuideRegistry();
const metrics = new Metrics();
const detector = new BiteDetector();
const logger = new Logger();
const audio = new AlertAudio();

let state = State.IDLE;
let cvRuntime = null;
let tracker = null;
let signalValues = [];
let lastGuides = [];

loadOpenCv((status) => {
  ui.opencvText.textContent = status;
})
  .then((cv) => {
    cvRuntime = cv;
    ui.opencvText.textContent = "ready";
    render();
  })
  .catch((error) => {
    ui.opencvText.textContent = "failed";
    setMessage(error.message);
  });

ui.cameraButton.addEventListener("click", async () => {
  try {
    await audio.unlock();
    await startCamera(ui.video);
    syncCanvasToVideo(ui.video, ui.overlay);
    state = State.CAMERA_READY;
    setMessage("REGISTER GUIDESでガイドを元側から順番にタップしてください。");
    render();
  } catch (error) {
    setMessage(`カメラを開始できません: ${error.message}`);
  }
});

ui.registerButton.addEventListener("click", () => {
  stopTracking();
  registry.clear();
  lastGuides = [];
  metrics.reset();
  state = State.REGISTERING;
  setMessage("G1を元側として、穂先側へ順番にタップしてください。3点以上でDONEできます。");
  render();
});

ui.undoButton.addEventListener("click", () => {
  registry.undo();
  render();
});

ui.clearButton.addEventListener("click", () => {
  registry.clear();
  render();
});

ui.doneButton.addEventListener("click", () => {
  if (registry.guides.length < 3) {
    setMessage("最低3点のガイド登録が必要です。");
    return;
  }
  state = State.READY_TO_TRACK;
  lastGuides = registry.snapshot();
  setMessage("START TRACKINGで追跡を開始します。");
  render();
});

ui.trackingButton.addEventListener("click", () => {
  if (state === State.TRACKING) {
    stopTracking();
    state = State.READY_TO_TRACK;
    setMessage("追跡を停止しました。");
  } else {
    startTracking();
  }
  render();
});

ui.markButton.addEventListener("click", () => {
  logger.markHit("hit");
  setMessage("MARK HITを記録しました。");
});

ui.resetButton.addEventListener("click", () => {
  stopTracking();
  registry.clear();
  lastGuides = [];
  metrics.reset();
  signalValues = [];
  state = ui.video.srcObject ? State.CAMERA_READY : State.IDLE;
  setMessage("登録と追跡状態をリセットしました。");
  render();
});

ui.exportCsvButton.addEventListener("click", () => {
  downloadText(exportName("csv"), "text/csv;charset=utf-8", logger.toCsv());
});

ui.exportJsonButton.addEventListener("click", () => {
  downloadText(exportName("json"), "application/json;charset=utf-8", JSON.stringify(logger.toJson(), null, 2));
});

ui.sensitivityInput.addEventListener("input", () => {
  CONFIG.sensitivity = Number(ui.sensitivityInput.value);
  ui.sensitivityText.textContent = String(CONFIG.sensitivity);
});

ui.overlay.addEventListener("pointerdown", (event) => {
  if (state !== State.REGISTERING || !ui.video.videoWidth) return;
  const point = eventToVideoPoint(event, ui.video);
  if (!point) return;
  registry.add(point);
  setMessage(`${registry.guides.length}点登録済み。誤タップはUNDO LASTで戻せます。`);
  render();
});

window.addEventListener("resize", () => {
  if (ui.video.videoWidth) syncCanvasToVideo(ui.video, ui.overlay);
  render();
});

requestAnimationFrame(loop);
render();

function startTracking() {
  if (!cvRuntime) {
    setMessage("OpenCV.jsのロード完了を待っています。");
    return;
  }
  if (registry.guides.length < 3) {
    setMessage("追跡には最低3点のガイド登録が必要です。");
    return;
  }
  syncCanvasToVideo(ui.video, ui.overlay);
  tracker = new GuideTracker(ui.video, cvRuntime);
  lastGuides = tracker.start(registry.snapshot());
  metrics.reset();
  state = State.TRACKING;
  setMessage("追跡中です。アタリならMARK HITを押してください。");
}

function stopTracking() {
  if (tracker) {
    tracker.stop();
    tracker = null;
  }
}

function loop(now) {
  if (ui.video.videoWidth) syncCanvasToVideo(ui.video, ui.overlay);

  if (state === State.TRACKING && tracker) {
    lastGuides = tracker.step(now);
    const normalized = normalizeGuides(lastGuides);
    const measured = metrics.measure(normalized, now);
    const health = trackingHealth(lastGuides);
    const result = detector.score(measured, health, state);
    signalValues.push(Math.min(1, result.score));
    if (signalValues.length > 320) signalValues = signalValues.slice(-320);

    logger.recordFrame({
      t: now,
      state,
      guides: normalized,
      tracked: health.tracked,
      weak: health.weak,
      lost: health.lost,
      tipDelta: measured.tipDelta,
      shapeDelta: measured.shapeDelta,
      score: result.score,
      candidate: result.candidate,
      userMark: null
    });

    if (result.candidate) {
      audio.beep();
      flashBite();
    }

    ui.scoreText.textContent = result.score.toFixed(2);
    ui.trackingText.textContent = `${health.tracked}/${health.total}`;
    drawOverlay(ui.overlay, lastGuides, { candidate: result.candidate });
    drawSignal(ui.signal, signalValues);
  } else {
    drawOverlay(ui.overlay, registry.snapshot().length ? registry.snapshot() : lastGuides);
    drawSignal(ui.signal, signalValues);
  }

  updateButtons();
  requestAnimationFrame(loop);
}

function render() {
  ui.stateText.textContent = state;
  ui.sensitivityText.textContent = String(CONFIG.sensitivity);
  ui.sensitivityInput.value = String(CONFIG.sensitivity);
  const guides = registry.snapshot().length ? registry.snapshot() : lastGuides;
  ui.trackingText.textContent = trackingLabel(guides);
  drawOverlay(ui.overlay, guides);
  drawSignal(ui.signal, signalValues);
  updateButtons();
}

function updateButtons() {
  const cameraReady = state !== State.IDLE;
  const registering = state === State.REGISTERING;
  const canTrack = state === State.READY_TO_TRACK || state === State.TRACKING;

  ui.cameraButton.disabled = cameraReady;
  ui.registerButton.disabled = !cameraReady || state === State.TRACKING;
  ui.undoButton.disabled = !registering || registry.guides.length === 0;
  ui.clearButton.disabled = !registering || registry.guides.length === 0;
  ui.doneButton.disabled = !registering || registry.guides.length < 3;
  ui.trackingButton.disabled = !canTrack || !cvRuntime;
  ui.trackingButton.textContent = state === State.TRACKING ? "STOP" : "START TRACKING";
  ui.markButton.disabled = state !== State.TRACKING;
  ui.resetButton.disabled = state === State.IDLE && registry.guides.length === 0;
  ui.exportCsvButton.disabled = logger.frames.length === 0;
  ui.exportJsonButton.disabled = logger.frames.length === 0;
}

function setMessage(message) {
  ui.messageText.textContent = message;
}

function trackingHealth(guides) {
  return guides.reduce(
    (health, guide) => {
      health.total += 1;
      if (guide.status === "tracked" || guide.status === "recovered") health.tracked += 1;
      if (guide.status === "weak") health.weak += 1;
      if (guide.status === "lost") health.lost += 1;
      return health;
    },
    { total: 0, tracked: 0, weak: 0, lost: 0 }
  );
}

function trackingLabel(guides) {
  const health = trackingHealth(guides);
  return `${health.tracked}/${health.total}`;
}

function flashBite() {
  ui.biteFlash.classList.add("active");
  setTimeout(() => ui.biteFlash.classList.remove("active"), 520);
}

function exportName(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `rod-bite-${stamp}.${extension}`;
}
