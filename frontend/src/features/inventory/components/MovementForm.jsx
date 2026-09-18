import { useState } from "react"

const ACTION_CONFIG = {
  ISSUE: {
    title: "เบิกใช้งาน",
    submitLabel: "ยืนยันการเบิก",
    needsLocation: true,
  },

  MOVE: {
    title: "ย้ายตำแหน่ง",
    submitLabel: "ยืนยันการย้าย",
    needsLocation: true,
  },

  CLAIM: {
    title: "ส่งเคลม",
    submitLabel: "ยืนยันการเคลม",
    needsLocation: true,
  },

  CLAIM_RETURN: {
    title: "รับคืนจากเคลม",
    submitLabel: "ยืนยันรับคืน",
    needsLocation: true,
  },

  REPLACED: {
    title: "เปลี่ยนอุปกรณ์ทดแทน",
    submitLabel: "ยืนยันการเปลี่ยนอุปกรณ์",
    needsLocation: true,
    needsReplacement: true,
    requiresConfirmation: true,
    warning:
      "อุปกรณ์เดิมจะเปลี่ยนเป็นสถานะ REPLACED และระบบจะสร้างอุปกรณ์ใหม่ด้วย Serial Number ใหม่",
  },

  RETIRE: {
    title: "ปลดระวาง",
    submitLabel: "ยืนยันการปลดระวาง",
    needsLocation: true,
    requiresConfirmation: true,
    warning:
      "เมื่อปลดระวางแล้ว อุปกรณ์จะอยู่สถานะ RETIRED และไม่สามารถทำ Movement ตามปกติได้อีก",
  },
}


function MovementForm({
  action,
  onSubmit,
  loading = false,
  onCancel,
}) {
  const config = ACTION_CONFIG[action]

  const [performedBy, setPerformedBy] =
    useState("")

  const [toLocation, setToLocation] =
    useState("")

  const [note, setNote] =
    useState("")

  const [newSerialNumber, setNewSerialNumber] =
    useState("")

  const [distributor, setDistributor] =
    useState("")

  const [confirmed, setConfirmed] =
    useState(false)

  const [formError, setFormError] =
    useState("")


  if (!config) {
    return null
  }


  async function handleSubmit(event) {
    event.preventDefault()

    setFormError("")

    const cleanPerformedBy =
      performedBy.trim()

    const cleanLocation =
      toLocation.trim()

    const cleanNewSerial =
      newSerialNumber.trim()


    if (!cleanPerformedBy) {
      setFormError(
        "กรุณาระบุผู้ดำเนินการ"
      )
      return
    }


    if (
      config.needsLocation &&
      !cleanLocation
    ) {
      setFormError(
        "กรุณาระบุตำแหน่งปลายทาง"
      )
      return
    }


    if (
      config.needsReplacement &&
      !cleanNewSerial
    ) {
      setFormError(
        "กรุณาระบุ Serial Number ใหม่"
      )
      return
    }


    if (
      config.requiresConfirmation &&
      !confirmed
    ) {
      setFormError(
        "กรุณายืนยันว่าคุณตรวจสอบข้อมูลแล้ว"
      )
      return
    }


    const data = {
      performedBy: cleanPerformedBy,
      note: note.trim(),
    }


    if (config.needsLocation) {
      data.toLocation =
        cleanLocation
    }


    if (config.needsReplacement) {
      data.newSerialNumber =
        cleanNewSerial

      data.currentLocation =
        cleanLocation

      data.distributor =
        distributor.trim()

      delete data.toLocation
    }


    await onSubmit?.(data)
  }


  return (
    <section className="card">
      <div className="card-header">
        <h2>
          {config.title}
        </h2>
      </div>


      {config.warning && (
        <div className="message message-warning">
          {config.warning}
        </div>
      )}


      {formError && (
        <div className="message message-error">
          {formError}
        </div>
      )}


      <form
        className="form-grid"
        onSubmit={handleSubmit}
      >
        {config.needsReplacement && (
          <>
            <div className="form-field">
              <label htmlFor="newSerialNumber">
                Serial Number ใหม่
              </label>

              <input
                id="newSerialNumber"
                value={newSerialNumber}
                onChange={(event) =>
                  setNewSerialNumber(
                    event.target.value
                  )
                }
                required
                disabled={loading}
              />
            </div>


            <div className="form-field">
              <label htmlFor="distributor">
                Distributor
              </label>

              <input
                id="distributor"
                value={distributor}
                onChange={(event) =>
                  setDistributor(
                    event.target.value
                  )
                }
                disabled={loading}
              />
            </div>
          </>
        )}


        {config.needsLocation && (
          <div className="form-field">
            <label htmlFor="toLocation">
              {action === "REPLACED"
                ? "ตำแหน่งของอุปกรณ์ใหม่"
                : "ตำแหน่งปลายทาง"}
            </label>

            <input
              id="toLocation"
              value={toLocation}
              onChange={(event) =>
                setToLocation(
                  event.target.value
                )
              }
              required
              disabled={loading}
            />
          </div>
        )}


        <div className="form-field">
          <label htmlFor="performedBy">
            ผู้ดำเนินการ
          </label>

          <input
            id="performedBy"
            value={performedBy}
            onChange={(event) =>
              setPerformedBy(
                event.target.value
              )
            }
            required
            disabled={loading}
          />
        </div>


        <div className="form-field form-field-full">
          <label htmlFor="movementNote">
            หมายเหตุ
          </label>

          <textarea
            id="movementNote"
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            rows="3"
            disabled={loading}
          />
        </div>


        {config.requiresConfirmation && (
          <div className="form-field form-field-full">
            <label className="confirmation-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) =>
                  setConfirmed(
                    event.target.checked
                  )
                }
                disabled={loading}
              />

              <span>
                ฉันตรวจสอบข้อมูลแล้วและยืนยันการดำเนินการ
              </span>
            </label>
          </div>
        )}


        <div className="form-actions form-field-full">
          <button
            type="submit"
            className="button button-primary"
            disabled={
              loading ||
              (
                config.requiresConfirmation &&
                !confirmed
              )
            }
          >
            {loading
              ? "กำลังดำเนินการ..."
              : config.submitLabel}
          </button>


          {onCancel && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

export default MovementForm