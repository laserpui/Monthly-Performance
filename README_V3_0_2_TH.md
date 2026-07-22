# Monthly Performance V3.0.2

เวอร์ชันนี้แก้ปัญหาการเชื่อมต่อที่ต้องกรอก Apps Script URL ซ้ำ โดยฝัง Backend URL ไว้ใน `app.js` โดยตรง

## การเปลี่ยนแปลง

- เปิดเว็บแล้วเชื่อมต่อ Google Apps Script อัตโนมัติ
- ไม่อ่าน Backend URL จาก localStorage
- นำช่องกรอก URL ปุ่มบันทึก URL และปุ่มโหมดทดลองออกจากหน้าเว็บ
- คงปุ่มตรวจสอบการเชื่อมต่อไว้สำหรับทดสอบ Backend ที่ฝังในระบบ
- ลองเชื่อมต่อซ้ำอัตโนมัติเมื่อ Google Apps Script ตอบช้า
- เพิ่ม cache-busting `app.js?v=3.0.2`

## ไฟล์ที่ต้องอัปเดตบน GitHub

1. `index.html`
2. `app.js`

ไม่ต้องเปลี่ยน `styles.css` หรือ `Code.gs` และไม่ต้อง Deploy Apps Script ใหม่
