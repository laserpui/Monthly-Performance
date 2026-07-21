# Monthly Performance V3.0

เวอร์ชันนี้อัปเกรดจาก V2.6 โดยไม่ลบข้อมูลเดิมใน Google Sheet

## ฟังก์ชันใหม่

- ตรวจรหัส Admin ที่ Google Apps Script และใช้ Token อายุ 6 ชั่วโมง
- ปิดเดือน / ส่งตรวจ / เปิดเดือนกลับมา พร้อมเหตุผล
- ตรวจสอบความสมบูรณ์ก่อนปิดเดือน
- สำรอง Google Sheet อัตโนมัติก่อนปิดเดือน
- ลบพนักงานแบบ Soft Delete และกู้คืนได้
- Audit Log เก็บค่าเดิม ค่าใหม่ ผู้ดำเนินการ และรายละเอียด
- ประวัติการดำเนินการในหน้า Web
- ป้องกันการแก้ข้อมูลของเดือนที่ปิดแล้ว
- บันทึกร่างแบบฟอร์มในเบราว์เซอร์
- ป้องกันการกดปุ่มบันทึกซ้ำระหว่างประมวลผล
- แสดงพนักงานที่ลบแล้วในรายงานย้อนหลังโดยไม่ทำข้อมูลเดิมหาย

## การอัปเกรด Google Apps Script

1. สำรองไฟล์ Google Sheet ก่อนเริ่ม
2. เปิด Google Sheet → Extensions → Apps Script
3. แทนที่ Code.gs เดิมด้วย `apps-script/Code.gs`
4. ตรวจ `appsscript.json` ให้ใช้ V8 runtime
5. กด Save
6. เลือกฟังก์ชัน `SYSTEM_TEST` แล้วกด Run
7. เมื่อผ่าน ให้เลือก `setup` แล้วกด Run หนึ่งครั้ง
8. `setup` จะเพิ่มคอลัมน์ใหม่และชีต `MonthStatus` โดยไม่ลบข้อมูลเดิม
9. Deploy → Manage deployments → Edit → New version → Deploy
10. ใช้ URL `/exec` เดิมได้ถ้าแก้ Deployment เดิม

## การอัปเดต GitHub Pages

แทนที่ไฟล์:

- `index.html`
- `styles.css`
- `app.js`

จากนั้นรอ GitHub Pages อัปเดตและกด `Ctrl + F5`

## รหัส Admin เริ่มต้น

`Admin1234`

รหัสผ่านไม่ได้อยู่ใน app.js แต่เก็บเป็น SHA-256 ในชีต Settings แถว `adminPasswordHash`

## ชีตและคอลัมน์ที่เพิ่ม

### Employees

เพิ่ม `deletedAt`, `deletedBy`

### AuditLog

เพิ่ม `beforeJson`, `afterJson`, `metadataJson` โดยรักษาคอลัมน์ `payload` เดิมไว้

### MonthStatus

เก็บสถานะ OPEN / REVIEW / CLOSED, ผู้ปิดเดือน, ผลตรวจสอบ และ File ID ของ Backup

## หลักการปิดเดือน

- OPEN: เพิ่มและแก้ไขได้
- REVIEW: อยู่ระหว่างตรวจ แต่ยังแก้ไขได้
- CLOSED: เปิดดูและ Export ได้ แต่เพิ่ม แก้ และปรับวันทำงานไม่ได้
- ก่อน CLOSED ระบบต้องไม่มี ERROR และจะสำรอง Google Sheet อัตโนมัติ
- การเปิด CLOSED กลับเป็น OPEN ต้องระบุเหตุผล

## หมายเหตุ

ระบบตรวจสอบคะแนนเก่าที่เกินช่วงปัจจุบันเป็น WARNING เพื่อไม่ขัดขวางการปิดเดือนย้อนหลัง แต่ควรตรวจและแก้ไขหากเป็นข้อมูลป้อนผิด
