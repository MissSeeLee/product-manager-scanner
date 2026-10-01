import { Link } from "react-router-dom";

import { useAuth } from "../../auth/authContext";

export default function MorePage() {
  const { user } = useAuth();

  const items = [
    {
      to: "/projects",
      title: "โครงการ / งาน",
      detail: "สถานะงาน อุปกรณ์ และการจัดการโครงการ",
    },
    {
      to: "/products",
      title: "รุ่นสินค้า",
      detail: "Product Master และ Active / Archive",
    },
    {
      to: "/locations",
      title: "สถานที่",
      detail: "Location Master และข้อมูลการใช้งาน",
    },
    {
      to: "/activity",
      title: "ประวัติกิจกรรม",
      detail: "Movement + Record Change",
    },
    {
      to: "/account",
      title: "บัญชีของฉัน",
      detail: "ข้อมูลบัญชีและรหัสผ่าน",
    },
  ];

  if (user?.role === "ADMIN") {
    items.push({
      to: "/users",
      title: "ผู้ใช้และสิทธิ์",
      detail: "User / Role / Session",
    });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">เพิ่มเติม</h1>
          <p className="page-description">
            เมนูที่ไม่ควรหายไปเมื่อใช้งานบนมือถือ
          </p>
        </div>
      </div>

      <div className="ux-more-grid">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="card ux-more-card">
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
            <span className="text-link">เปิด →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
