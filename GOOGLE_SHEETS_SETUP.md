# เชื่อมเว็บกับ Google Sheets

ฐานข้อมูลที่ใช้:

- Spreadsheet: [Monthly Evaluation Database](https://docs.google.com/spreadsheets/d/1X0b5R4dRsf-v7NVKJDHcSAtlA0DQohTgqxRl82X_tKc/edit)
- Spreadsheet ID: `1X0b5R4dRsf-v7NVKJDHcSAtlA0DQohTgqxRl82X_tKc`

## ติดตั้ง API

1. เปิด [Google Apps Script](https://script.google.com/) แล้วสร้างโปรเจกต์ใหม่
2. คัดลอกเนื้อหาจาก `Code.gs` ไปวางแทนโค้ดเดิม
3. กด **Deploy > New deployment**
4. เลือกชนิด **Web app**
5. ตั้ง **Execute as: Me** และเลือกสิทธิ์เข้าถึงให้เหมาะกับทีม
6. กด Deploy และอนุญาตสิทธิ์อ่าน/เขียน Spreadsheet
7. คัดลอก URL ที่ลงท้ายด้วย `/exec`
8. วาง URL ใน `config.js` ที่ `googleSheetsApiUrl`

หากต้องการใช้ token เพิ่มเติม ให้สร้าง Script Property ชื่อ `API_TOKEN` ใน Apps Script และใส่ค่าเดียวกันที่ `apiToken` ใน `config.js`

## ทดสอบ

เปิด URL ต่อไปนี้ใน Browser โดยแทน `<WEB_APP_URL>`:

```text
<WEB_APP_URL>?action=health
```

ผลลัพธ์ที่ถูกต้อง:

```json
{"ok":true,"service":"monthly-evaluation-sheets-api"}
```

จากนั้นเปิด `index.html` เว็บจะโหลดข้อมูลจาก Google Sheets และบันทึกกลับอัตโนมัติ ส่วน `localStorage` ใช้เป็น cache สำรองเมื่อการเชื่อมต่อล้มเหลวเท่านั้น
