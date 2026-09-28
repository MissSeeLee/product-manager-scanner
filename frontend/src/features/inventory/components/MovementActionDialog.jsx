import { useEffect, useRef } from "react";

import { MOVEMENT_FORM_CONFIG } from "../config/inventoryConfig";
import MovementForm from "./MovementForm";

function MovementActionDialog({
  action,
  item,
  loading = false,
  locations = [],
  projects = [],
  onSubmit,
  onClose,
}) {
  const panelRef = useRef(null);
  const config = MOVEMENT_FORM_CONFIG[action];

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onClose]);

  if (!config) {
    return null;
  }

  return (
    <div
      className="movement-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <section
        ref={panelRef}
        className="movement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-dialog-title"
        tabIndex="-1"
      >
        <header className="movement-dialog-header">
          <div>
            <span className="movement-dialog-serial serial-text">
              {item?.serial_number}
            </span>
            <h2 id="movement-dialog-title">{config.title}</h2>
            <p>
              {item?.product_name || "ไม่ระบุรุ่น"}
              {item?.current_location ? ` · ปัจจุบัน ${item.current_location}` : ""}
            </p>
          </div>

          <button
            type="button"
            className="movement-dialog-close"
            onClick={onClose}
            disabled={loading}
            aria-label="ปิดหน้าต่าง"
          >
            ×
          </button>
        </header>

        <div className="movement-dialog-body">
          <MovementForm
            action={action}
            loading={loading}
            locations={locations}
            projects={projects}
            onSubmit={onSubmit}
            onCancel={onClose}
            embedded
          />
        </div>
      </section>
    </div>
  );
}

export default MovementActionDialog;
