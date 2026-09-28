import { useEffect, useRef, useState } from "react";

import { decodeBarcode } from "../../scanner/lib/zxingReader";

const REQUIRED_MATCHES = 3;
const SCAN_INTERVAL_MS = 160;
const MAX_MATCH_GAP_MS = 1200;
const SAME_CODE_COOLDOWN_MS = 2500;

function OperationBarcodeScanner({ onScan, disabled = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const lastFrameRef = useRef(0);
  const candidateRef = useRef({ value: "", count: 0, lastSeen: 0 });
  const emittedRef = useRef({ value: "", at: 0 });

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  function resetCandidate() {
    candidateRef.current = { value: "", count: 0, lastSeen: 0 };
    setCandidate("");
    setMatchCount(0);
  }

  function stop() {
    runningRef.current = false;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setRunning(false);
    setTorchAvailable(false);
    setTorchOn(false);
    resetCandidate();
  }

  async function start() {
    if (disabled || runningRef.current) {
      return;
    }

    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser นี้ไม่รองรับการใช้งานกล้อง");
      return;
    }

    try {
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      try {
        const capabilities = track.getCapabilities?.() ?? {};
        setTorchAvailable(capabilities.torch === true);

        if (
          Array.isArray(capabilities.focusMode) &&
          capabilities.focusMode.includes("continuous")
        ) {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        }
      } catch {
        // Camera capability tuning is optional.
      }

      const video = videoRef.current;

      if (!video) {
        stop();
        return;
      }

      video.srcObject = stream;
      await video.play();

      resetCandidate();
      runningRef.current = true;
      setRunning(true);
      lastFrameRef.current = 0;
      frameRef.current = requestAnimationFrame(scanLoop);
    } catch (cameraError) {
      stop();

      if (cameraError?.name === "NotAllowedError") {
        setError("ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera ใน Browser");
      } else if (cameraError?.name === "NotFoundError") {
        setError("ไม่พบกล้องที่สามารถใช้งานได้");
      } else {
        setError("ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์และลองใหม่");
      }
    }
  }

  async function toggleTorch() {
    const track = trackRef.current;

    if (!track || !torchAvailable) {
      return;
    }

    const next = !torchOn;

    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setError("อุปกรณ์นี้ไม่สามารถควบคุมไฟฉายผ่าน Browser ได้");
    }
  }

  async function processFrame() {
    if (!runningRef.current || processingRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) {
      return;
    }

    processingRef.current = true;

    try {
      const roiWidth = Math.floor(video.videoWidth * 0.92);
      const roiHeight = Math.floor(video.videoHeight * 0.5);
      const sourceX = Math.floor((video.videoWidth - roiWidth) / 2);
      const sourceY = Math.floor((video.videoHeight - roiHeight) / 2);

      canvas.width = roiWidth;
      canvas.height = roiHeight;

      const context = canvas.getContext("2d", { willReadFrequently: true });

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

      const result = await decodeBarcode(
        context.getImageData(0, 0, roiWidth, roiHeight),
      );
      const value = result?.value?.trim();

      if (!value) {
        return;
      }

      const now = performance.now();
      const previous = candidateRef.current;
      const count =
        previous.value === value && now - previous.lastSeen <= MAX_MATCH_GAP_MS
          ? previous.count + 1
          : 1;

      candidateRef.current = { value, count, lastSeen: now };
      setCandidate(value);
      setMatchCount(Math.min(count, REQUIRED_MATCHES));

      if (count < REQUIRED_MATCHES) {
        return;
      }

      const lastEmitted = emittedRef.current;
      const duplicateTooSoon =
        lastEmitted.value === value && now - lastEmitted.at < SAME_CODE_COOLDOWN_MS;

      resetCandidate();

      if (duplicateTooSoon) {
        return;
      }

      emittedRef.current = { value, at: now };
      await onScan?.({
        value,
        format: result.format,
        symbology: result.symbology,
      });
    } catch (decodeError) {
      console.error("Operation scanner decode failed:", decodeError);
    } finally {
      processingRef.current = false;
    }
  }

  function scanLoop(timestamp) {
    if (!runningRef.current) {
      return;
    }

    if (timestamp - lastFrameRef.current >= SCAN_INTERVAL_MS) {
      lastFrameRef.current = timestamp;
      processFrame();
    }

    frameRef.current = requestAnimationFrame(scanLoop);
  }

  useEffect(() => {
    const video = videoRef.current;

    return () => {
      runningRef.current = false;

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
      trackRef.current = null;

      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  return (
    <section className="operation-scanner" aria-label="สแกนเพิ่มอุปกรณ์">
      {error && <div className="message message-error">{error}</div>}

      <div className="operation-scanner-frame">
        <video ref={videoRef} playsInline muted />
        {running && (
          <div className="operation-scanner-target">
            <span>สแกนต่อเนื่อง · วาง Barcode / QR ในกรอบ</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} hidden />

      {candidate && (
        <div className="operation-scanner-feedback">
          <span className="serial-text">{candidate}</span>
          <span>{matchCount}/{REQUIRED_MATCHES}</span>
        </div>
      )}

      <div className="operation-scanner-actions">
        {!running ? (
          <button type="button" className="button button-primary" onClick={start} disabled={disabled}>
            เปิดกล้องเพื่อสแกนต่อเนื่อง
          </button>
        ) : (
          <>
            {torchAvailable && (
              <button type="button" className="button button-secondary" onClick={toggleTorch}>
                {torchOn ? "ปิดไฟฉาย" : "เปิดไฟฉาย"}
              </button>
            )}
            <button type="button" className="button button-secondary" onClick={stop}>
              ปิดกล้อง
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default OperationBarcodeScanner;
