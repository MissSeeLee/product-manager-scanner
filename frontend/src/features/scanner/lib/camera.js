const BASE_VIDEO_CONSTRAINTS = {
  width: {
    ideal: 1920,
  },

  height: {
    ideal: 1080,
  },

  frameRate: {
    ideal: 30,
  },
};

// --------------------------------------------------
// REQUEST REAR CAMERA
// --------------------------------------------------

export async function requestRearCamera() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,

      video: {
        ...BASE_VIDEO_CONSTRAINTS,

        facingMode: {
          exact: "environment",
        },
      },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,

      video: {
        ...BASE_VIDEO_CONSTRAINTS,

        facingMode: {
          ideal: "environment",
        },
      },
    });
  }
}

// --------------------------------------------------
// CAMERA CAPABILITIES / AUTOFOCUS
// --------------------------------------------------

export async function tuneCameraTrack(track) {
  if (!track) {
    return {
      info: null,
      torchAvailable: false,

      zoom: {
        supported: false,
        min: 1,
        max: 1,
        step: 0.1,
        value: 1,
      },
    };
  }

  let capabilities;

  try {
    capabilities = track.getCapabilities?.() ?? {};
  } catch {
    capabilities = {};
  }

  // Continuous autofocus เมื่อ Browser รองรับ
  if (
    Array.isArray(capabilities.focusMode) &&
    capabilities.focusMode.includes("continuous")
  ) {
    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "continuous",
          },
        ],
      });
    } catch {
      // Browser จัดการ autofocus เอง
    }
  }

  const torchAvailable = capabilities.torch === true;

  const zoom = {
    supported: false,
    min: 1,
    max: 1,
    step: 0.1,
    value: 1,
  };

  if (
    capabilities.zoom &&
    Number.isFinite(capabilities.zoom.min) &&
    Number.isFinite(capabilities.zoom.max)
  ) {
    zoom.min = capabilities.zoom.min;

    zoom.max = capabilities.zoom.max;

    zoom.step = capabilities.zoom.step || 0.1;

    zoom.value = zoom.min;

    try {
      const settings = track.getSettings?.();

      if (Number.isFinite(settings?.zoom)) {
        zoom.value = settings.zoom;
      }
    } catch {
      // ใช้ค่า min
    }

    zoom.supported = zoom.max > zoom.min;
  }

  let info;

  try {
    const settings = track.getSettings?.() ?? {};

    info = {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      facingMode: settings.facingMode,
    };
  } catch {
    info = null;
  }

  return {
    info,
    torchAvailable,
    zoom,
  };
}

// --------------------------------------------------
// TORCH
// --------------------------------------------------

export async function applyTorch(track, enabled) {
  if (!track) {
    return;
  }

  await track.applyConstraints({
    advanced: [
      {
        torch: enabled,
      },
    ],
  });
}

// --------------------------------------------------
// ZOOM
// --------------------------------------------------

export async function applyZoom(track, value) {
  if (!track) {
    return;
  }

  await track.applyConstraints({
    advanced: [
      {
        zoom: value,
      },
    ],
  });
}

// --------------------------------------------------
// STOP CAMERA
// --------------------------------------------------

export function stopMediaStream(stream) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}
