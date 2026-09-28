export const OPERATION_TYPES = {
  ISSUE: "ISSUE",
  RETURN: "RETURN",
  MOVE: "MOVE",
};

export const OPERATION_CONFIG = {
  ISSUE: {
    label: "เบิกอุปกรณ์",
    shortLabel: "เบิก",
    description: "นำอุปกรณ์ที่อยู่ในคลังไปใช้งานหลายรายการในครั้งเดียว",
    submitLabel: "ยืนยันการเบิก",
    destinationLabel: "สถานที่ใช้งาน",
    allowedStatuses: ["IN_STOCK"],
  },
  RETURN: {
    label: "รับคืนอุปกรณ์",
    shortLabel: "รับคืน",
    description: "รับคืนอุปกรณ์ที่กำลังใช้งานกลับเข้าคลังพร้อมกัน",
    submitLabel: "ยืนยันการรับคืน",
    destinationLabel: "สถานที่รับคืน",
    allowedStatuses: ["IN_USE"],
  },
  MOVE: {
    label: "ย้ายหลายอุปกรณ์",
    shortLabel: "ย้าย",
    description: "ย้ายตำแหน่งหลายอุปกรณ์โดยคงสถานะเดิม",
    submitLabel: "ยืนยันการย้าย",
    destinationLabel: "สถานที่ปลายทาง",
    allowedStatuses: ["IN_STOCK", "IN_USE", "CLAIM"],
  },
};

export function operationLabel(type) {
  return OPERATION_CONFIG[type]?.label || type || "รายการ";
}

export function operationEligible(type, status) {
  return OPERATION_CONFIG[type]?.allowedStatuses?.includes(status) ?? false;
}
