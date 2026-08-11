export const CONFIG = {
  processingWidth: 640,
  targetFPS: 18,
  roiSize: 54,
  maxFeaturesPerGuide: 28,
  minFeaturesPerGuide: 7,
  lkWinSize: 21,
  lkLevels: 3,
  maxFlowError: 34,
  weakDistancePx: 18,
  sensitivity: 58,
  eventPreMs: 4000,
  eventPostMs: 2500,
  biteCooldownMs: 900,
  overlay: {
    boxes: true,
    labels: true,
    polyline: true,
    arrows: false,
    debug: false
  },
  opencvSources: [
    "./vendor/opencv.js",
    "https://docs.opencv.org/4.10.0/opencv.js"
  ]
};

export function scoreThreshold(sensitivity = CONFIG.sensitivity) {
  return 0.78 - (sensitivity / 100) * 0.62;
}
