import {
  useBarcodeScanner,
} from "../hooks/useBarcodeScanner"


function BarcodeScanner({
  onScan,
  disabled = false,
}) {
  const {
    videoRef,
    canvasRef,

    running,
    error,

    candidateText,
    matchCount,
    requiredMatches,

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
  } = useBarcodeScanner({
    onScan,
    disabled,
  })


  function handleZoomChange(event) {
    changeZoom(
      Number(event.target.value)
    )
  }


  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>
            สแกน Barcode / QR Code
          </h2>

          <p className="text-muted">
            จัด Barcode ให้อยู่ภายในกรอบกลางภาพ
          </p>
        </div>
      </div>


      {error && (
        <div className="message message-error">
          {error}
        </div>
      )}


      <div className="scanner-container">
        <video
          ref={videoRef}
          className="scanner-video"
          playsInline
          muted
        />

        {running && (
          <div className="scanner-target">
            <span>
              วาง Barcode / QR
              ให้อยู่ในกรอบ
            </span>
          </div>
        )}
      </div>


      <canvas
        ref={canvasRef}
        hidden
      />


      {running && cameraInfo && (
        <div className="scanner-camera-info">
          <span>
            Camera:{" "}
            {cameraInfo.width || "?"}
            ×
            {cameraInfo.height || "?"}
          </span>

          {cameraInfo.frameRate && (
            <span>
              {Math.round(
                cameraInfo.frameRate
              )}{" "}
              FPS
            </span>
          )}
        </div>
      )}


      {running && (
        <div className="scanner-camera-controls">
          {torchAvailable && (
            <button
              type="button"
              className="button button-secondary"
              onClick={toggleTorch}
            >
              {torchOn
                ? "ปิดไฟฉาย"
                : "เปิดไฟฉาย"}
            </button>
          )}


          {zoomSupported && (
            <div className="scanner-zoom">
              <label htmlFor="scannerZoom">
                Zoom{" "}
                {zoomValue.toFixed(1)}×
              </label>

              <input
                id="scannerZoom"
                type="range"
                min={zoomMin}
                max={zoomMax}
                step={zoomStep}
                value={zoomValue}
                onChange={handleZoomChange}
              />
            </div>
          )}
        </div>
      )}


      {candidateText && (
        <div className="scanner-feedback">
          <span>
            ตรวจพบ:
          </span>

          <strong>
            {candidateText}
          </strong>

          <span>
            ตรวจสอบความตรงกัน{" "}
            {matchCount}/
            {requiredMatches}
          </span>
        </div>
      )}


      <div className="form-actions">
        {!running ? (
          <button
            type="button"
            className="button button-primary"
            onClick={startScanner}
            disabled={disabled}
          >
            เปิดกล้อง
          </button>
        ) : (
          <button
            type="button"
            className="button button-secondary"
            onClick={stopScanner}
          >
            ปิดกล้อง
          </button>
        )}
      </div>
    </section>
  )
}


export default BarcodeScanner