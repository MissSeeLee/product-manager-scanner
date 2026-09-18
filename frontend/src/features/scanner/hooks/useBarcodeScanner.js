import { useEffect, useRef, useState } from "react";

import { decodeBarcode } from "../lib/zxingReader";

import {
  applyTorch,
  applyZoom,
  requestRearCamera,
  stopMediaStream,
  tuneCameraTrack,
} from "../lib/camera";

const REQUIRED_MATCHES = 3;
const SCAN_INTERVAL_MS = 160;
const MAX_MATCH_GAP_MS = 1200;

export function useBarcodeScanner({ onScan, disabled = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const streamRef = useRef(null);
  const trackRef = useRef(null);

  const cameraInfoRef = useRef(null);

  const animationRef = useRef(null);

  const scanningRef = useRef(false);
  const processingRef = useRef(false);

  const lastScanTimeRef = useRef(0);
  const scanStartedAtRef = useRef(null);
  const decodeAttemptsRef = useRef(0);

  const candidateRef = useRef({
    value: "",
    count: 0,
    lastSeen: 0,
  });

  const [running, setRunning] = useState(false);

  const [error, setError] = useState("");

  const [candidateText, setCandidateText] = useState("");

  const [matchCount, setMatchCount] = useState(0);

  const [cameraInfo, setCameraInfo] = useState(null);

  const [torchAvailable, setTorchAvailable] = useState(false);

  const [torchOn, setTorchOn] = useState(false);

  const [zoomSupported, setZoomSupported] = useState(false);

  const [zoomMin, setZoomMin] = useState(1);

  const [zoomMax, setZoomMax] = useState(1);

  const [zoomStep, setZoomStep] = useState(0.1);

  const [zoomValue, setZoomValue] = useState(1);

  function resetCandidate() {
    candidateRef.current = {
      value: "",
      count: 0,
      lastSeen: 0,
    };

    setCandidateText("");
    setMatchCount(0);
  }

  function releaseCamera() {
    scanningRef.current = false;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);

      animationRef.current = null;
    }

    stopMediaStream(streamRef.current);

    streamRef.current = null;
    trackRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchAvailable(false);
    setTorchOn(false);

    setZoomSupported(false);

    setCameraInfo(null);
    cameraInfoRef.current = null;
  }

  function stopScanner() {
    releaseCamera();
    resetCandidate();

    setRunning(false);
  }

  async function toggleTorch() {
    const track = trackRef.current;

    if (!track || !torchAvailable) {
      return;
    }

    const nextValue = !torchOn;

    try {
      await applyTorch(track, nextValue);

      setTorchOn(nextValue);
    } catch {
      setError("อุปกรณ์นี้ไม่สามารถควบคุมไฟฉายผ่าน Browser ได้");
    }
  }

  async function changeZoom(value) {
    const track = trackRef.current;

    setZoomValue(value);

    if (!track || !zoomSupported) {
      return;
    }

    try {
      await applyZoom(track, value);
    } catch {
      // Scanner ยังทำงานต่อได้
    }
  }

  async function processFrame() {
    if (!scanningRef.current || processingRef.current) {
      return;
    }

    const video = videoRef.current;

    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return;
    }

    processingRef.current = true;

    try {
      const videoWidth = video.videoWidth;

      const videoHeight = video.videoHeight;

      const roiWidth = Math.floor(videoWidth * 0.92);

      const roiHeight = Math.floor(videoHeight * 0.5);

      const sourceX = Math.floor((videoWidth - roiWidth) / 2);

      const sourceY = Math.floor((videoHeight - roiHeight) / 2);

      canvas.width = roiWidth;

      canvas.height = roiHeight;

      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!context) {
        return;
      }

      context.drawImage(
        video,

        sourceX,
        sourceY,
        roiWidth,
        roiHeight,

        0,
        0,
        roiWidth,
        roiHeight,
      );

      const imageData = context.getImageData(0, 0, roiWidth, roiHeight);

      decodeAttemptsRef.current += 1;

      const result = await decodeBarcode(imageData);

      if (!result?.value) {
        return;
      }

      const value = result.value.trim();

      if (!value) {
        return;
      }

      const now = performance.now();

      const previous = candidateRef.current;

      let nextCount = 1;

      if (
        previous.value === value &&
        now - previous.lastSeen <= MAX_MATCH_GAP_MS
      ) {
        nextCount = previous.count + 1;
      }

      candidateRef.current = {
        value,
        count: nextCount,
        lastSeen: now,
      };

      setCandidateText(value);

      setMatchCount(Math.min(nextCount, REQUIRED_MATCHES));

      if (nextCount >= REQUIRED_MATCHES) {
        scanningRef.current = false;

        const elapsedMs = scanStartedAtRef.current
          ? performance.now() - scanStartedAtRef.current
          : null;

        const benchmark = {
          elapsedMs: elapsedMs !== null ? Math.round(elapsedMs) : null,

          decodeAttempts: decodeAttemptsRef.current,

          camera: cameraInfoRef.current,
        };

        console.log("Scanner benchmark:", {
          value,
          format: result.format,
          ...benchmark,
        });

        releaseCamera();

        setRunning(false);

        onScan?.({
          value,
          format: result.format,
          symbology: result.symbology,
          benchmark,
        });
      }
    } catch (err) {
      console.error("Barcode decoding failed:", err);
    } finally {
      processingRef.current = false;
    }
  }

  function scanLoop(timestamp) {
    if (!scanningRef.current) {
      return;
    }

    if (timestamp - lastScanTimeRef.current >= SCAN_INTERVAL_MS) {
      lastScanTimeRef.current = timestamp;

      processFrame();
    }

    animationRef.current = requestAnimationFrame(scanLoop);
  }

  async function startScanner() {
    if (disabled || scanningRef.current) {
      return;
    }

    setError("");
    resetCandidate();

    scanStartedAtRef.current = performance.now();

    decodeAttemptsRef.current = 0;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Browser นี้ไม่รองรับการใช้งานกล้อง");

      return;
    }

    try {
      const stream = await requestRearCamera();

      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];

      trackRef.current = track;

      const video = videoRef.current;

      if (!video) {
        releaseCamera();
        return;
      }

      video.srcObject = stream;

      await video.play();

      const camera = await tuneCameraTrack(track);

      cameraInfoRef.current = camera.info;

      setCameraInfo(camera.info);

      setTorchAvailable(camera.torchAvailable);

      setZoomSupported(camera.zoom.supported);

      setZoomMin(camera.zoom.min);

      setZoomMax(camera.zoom.max);

      setZoomStep(camera.zoom.step);

      setZoomValue(camera.zoom.value);

      scanningRef.current = true;

      lastScanTimeRef.current = 0;

      setRunning(true);

      animationRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      releaseCamera();

      console.error("Camera start failed:", err);

      if (err?.name === "NotAllowedError") {
        setError("ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera ใน Browser");
      } else if (err?.name === "NotFoundError") {
        setError("ไม่พบกล้องที่สามารถใช้งานได้");
      } else {
        setError("ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์และลองใหม่");
      }

      setRunning(false);
    }
  }

  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, []);

  return {
    videoRef,
    canvasRef,

    running,
    error,

    candidateText,
    matchCount,
    requiredMatches: REQUIRED_MATCHES,

    cameraInfo,

    torchAvailable,
    torchOn,

    zoomSupported,
    zoomMin,
    zoomMax,
    zoomStep,
    zoomValue,

    startScanner,
    stopScanner,
    toggleTorch,
    changeZoom,
  };
}
