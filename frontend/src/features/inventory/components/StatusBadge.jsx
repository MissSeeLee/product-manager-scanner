import { STATUS_CONFIG } from "../config/inventoryConfig";

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status || "ไม่ทราบสถานะ",
    className: "status-badge",
  };

  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
