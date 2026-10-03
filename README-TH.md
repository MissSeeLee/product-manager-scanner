# AssetOps — สรุปโปรเจกต์ภาษาไทย

AssetOps คือระบบจัดการอุปกรณ์ IT แบบมองทั้งวงจรชีวิต ไม่ใช่แค่ CRUD ตารางสินค้า

Production: https://assetops.artip.site

## จุดเด่น

- ติดตาม Asset ระดับ Serial Number
- สถานะหลัก `IN_STOCK`, `IN_USE`, `CLAIM`, `REPLACED`, `RETIRED`
- Operation หลัก `RECEIVE`, `ISSUE`, `RETURN`, `MOVE`, `CLAIM`, `CLAIM_RETURN`, `REPLACED`, `RETIRE`
- Bulk operation เป็น transaction เดียว: ถ้ามีรายการใดไม่ผ่าน ทั้งชุดไม่ commit
- Scanner ช่วยอ่านข้อมูลแต่ไม่ commit อัตโนมัติ
- CSV ใช้ header มาตรฐาน 12 ช่องแบบตายตัว
- Product/Location ที่เคยถูกอ้างอิงจะไม่ถูกลบจนประวัติขาด
- มี Admin / Operator / Viewer
- Backend มี read-only database role แยกสำหรับ public read model
- Production ใช้ Vercel Services + Neon PostgreSQL + Cloudflare DNS

## สิ่งที่โปรเจกต์นี้โชว์ใน Portfolio

1. การออกแบบ state machine และ business rules
2. Transaction และ data integrity
3. RBAC และ session security
4. การออกแบบ UX สำหรับงาน operation
5. CSV validation / bulk workflow
6. การ deploy production จริง
7. การย้ายฐานข้อมูลไป Neon
8. Production smoke test และ regression QA

README หลักอยู่ที่ [`README.md`](README.md)
