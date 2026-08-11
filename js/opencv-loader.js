import { CONFIG } from "./config.js";

let loadPromise;

export function loadOpenCv(onStatus = () => {}) {
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (loadPromise) return loadPromise;

  loadPromise = trySources([...CONFIG.opencvSources], onStatus);
  return loadPromise;
}

function trySources(sources, onStatus) {
  const source = sources.shift();
  if (!source) {
    return Promise.reject(new Error("OpenCV.js could not be loaded"));
  }

  onStatus(`loading ${source.includes("http") ? "cdn" : "local"}`);
  return sourceAvailable(source)
    .then((available) => {
      if (!available) throw new Error(`${source} is not available`);
      return injectScript(source);
    })
    .then(() => waitForRuntime(onStatus))
    .catch(() => trySources(sources, onStatus));
}

async function sourceAvailable(src) {
  if (src.startsWith("http")) return true;
  try {
    const response = await fetch(src, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function waitForRuntime(onStatus) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (window.cv?.Mat) {
        if (window.cv.onRuntimeInitialized) {
          const previous = window.cv.onRuntimeInitialized;
          window.cv.onRuntimeInitialized = () => {
            previous();
            onStatus("ready");
            resolve(window.cv);
          };
        } else {
          onStatus("ready");
          resolve(window.cv);
        }
        return;
      }
      if (performance.now() - started > 15000) {
        reject(new Error("OpenCV.js runtime timeout"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}
