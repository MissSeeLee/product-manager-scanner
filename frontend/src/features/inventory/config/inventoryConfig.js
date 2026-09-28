export const INVENTORY_STATUS = {
  IN_STOCK: "IN_STOCK",
  IN_USE: "IN_USE",
  CLAIM: "CLAIM",
  REPLACED: "REPLACED",
  RETIRED: "RETIRED",
};

export const STATUS_CONFIG = {
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

export const ACTIONS_BY_STATUS = {
  IN_STOCK: ["ISSUE", "MOVE", "CLAIM", "RETIRE"],
  IN_USE: ["RETURN", "MOVE", "CLAIM", "RETIRE"],
  CLAIM: ["CLAIM_RETURN", "REPLACED", "MOVE", "RETIRE"],
  REPLACED: [],
  RETIRED: [],
};

export const ACTION_LABELS = {
  ISSUE: "เบิกใช้งาน",
  RETURN: "รับคืนเข้าคลัง",
  MOVE: "ย้ายตำแหน่ง",
  CLAIM: "ส่งเคลม",
  CLAIM_RETURN: "รับคืนจากเคลม",
  REPLACED: "เปลี่ยนอุปกรณ์ทดแทน",
  RETIRE: "ปลดระวาง",
};

export const ACTION_BUTTON_CLASSES = {
  ISSUE: "button button-primary",
  RETURN: "button button-primary",
  MOVE: "button button-secondary",
  CLAIM: "button button-secondary",
  CLAIM_RETURN: "button button-primary",
  REPLACED: "button button-warning",
  RETIRE: "button button-danger",
};

export const MOVEMENT_FORM_CONFIG = {
  ISSUE: {
    title: "เบิกอุปกรณ์ไปใช้งาน",
    submitLabel: "ยืนยันการเบิกใช้งาน",
    locationLabel: "ตำแหน่งที่นำไปใช้งาน",
    needsLocation: true,
  },
  RETURN: {
    title: "รับคืนอุปกรณ์เข้าคลัง",
    submitLabel: "ยืนยันการรับคืน",
    locationLabel: "ตำแหน่งที่รับคืน",
    needsLocation: true,
  },
  MOVE: {
    title: "ย้ายตำแหน่งอุปกรณ์",
    submitLabel: "ยืนยันการย้าย",
    locationLabel: "ตำแหน่งปลายทาง",
    needsLocation: true,
  },
  CLAIM: {
    title: "ส่งอุปกรณ์เคลม",
    submitLabel: "ยืนยันการส่งเคลม",
    locationLabel: "ปลายทางการเคลม",
    needsLocation: true,
  },
  CLAIM_RETURN: {
    title: "รับคืนอุปกรณ์จากเคลม",
    submitLabel: "ยืนยันรับคืนจากเคลม",
    locationLabel: "ตำแหน่งรับคืน",
    needsLocation: true,
  },
  REPLACED: {
    title: "เปลี่ยนอุปกรณ์ทดแทน",
    submitLabel: "ยืนยันการเปลี่ยนอุปกรณ์",
    locationLabel: "ตำแหน่งของอุปกรณ์ทดแทน",
    needsLocation: true,
    needsReplacement: true,
    requiresConfirmation: true,
    warning:
      "อุปกรณ์เดิมจะเข้าสู่สถานะ REPLACED และระบบจะสร้างอุปกรณ์ใหม่ด้วย Serial Number ใหม่",
  },
  RETIRE: {
    title: "ปลดระวางอุปกรณ์",
    submitLabel: "ยืนยันการปลดระวาง",
    locationLabel: "ตำแหน่งปลดระวาง",
    needsLocation: true,
    requiresConfirmation: true,
    warning:
      "หลังยืนยัน อุปกรณ์จะเข้าสู่สถานะ RETIRED และไม่สามารถทำ Movement ตามปกติได้อีก",
  },
};
