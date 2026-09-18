const STATUS_CONFIG = {
  IN_STOCK: {
    label: "อยู่ในคลัง",
    className: "status-badge status-in-stock",
  },

  IN_USE: {
    label: "กำลังใช้งาน",
    className: "status-badge status-in-use",
  },

  CLAIM: {
    label: "อยู่ระหว่างเคลม",
    className: "status-badge status-claim",
  },

  REPLACED: {
    label: "ถูกเปลี่ยนทดแทน",
    className: "status-badge status-replaced",
  },

  RETIRED: {
    label: "ปลดระวาง",
    className: "status-badge status-retired",
  },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status || "ไม่ทราบสถานะ",
    className: "status-badge",
  };

  return <span className={config.className}>{config.label}</span>;
}

export default StatusBadge;
