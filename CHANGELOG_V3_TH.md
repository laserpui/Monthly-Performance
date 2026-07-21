# CHANGELOG V3.0

## Security
- ย้ายการตรวจรหัส Admin ไป Backend
- ใช้ Token ชั่วคราวใน sessionStorage
- คำสั่งพนักงาน วันทำงาน ปิดเดือน และ Backup ตรวจ Token ทุกครั้ง

## Data governance
- เพิ่ม MonthStatus
- เพิ่ม Validation ก่อนปิดเดือน
- เพิ่ม Backup อัตโนมัติ
- เปลี่ยนลบพนักงานเป็น Soft Delete
- Audit Log เก็บ Before/After

## UX
- เพิ่มสถานะเดือนและผลตรวจสอบ
- เพิ่มหน้าประวัติ
- เพิ่มบันทึกร่าง
- ปิดปุ่มขณะบันทึก
- เพิ่มปุ่มคะแนนพื้นฐาน
