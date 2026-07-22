# Service Incentive

เว็บแอปสำหรับป้อนคะแนนพนักงานรายวัน สรุปผลรายเดือน และจัดเก็บข้อมูลใน Google Sheet

## โครงสร้างระบบ

- `index.html`, `styles.css`, `app.js` — เว็บหน้าใช้งาน นำขึ้น GitHub Pages ได้ทันที
- `apps-script/Code.gs` — API และสูตรคำนวณบน Google Apps Script
- `apps-script/appsscript.json` — การตั้งค่าโครงการ Apps Script

ระบบมี **โหมดทดลอง** ด้วย localStorage จึงเปิด `index.html` ทดลองได้ก่อนเชื่อม Google Sheet

เวอร์ชันนี้รองรับคะแนน **-0.50 ถึง 3.00 เพิ่มครั้งละ 0.25**, เรียงรายชื่อแบบภาษาไทย ก–ฮ, จัดเรียงตารางสรุป และเพิ่ม/แก้ไข/ลบพนักงาน

## สูตรคะแนน

1. คะแนนรวมแต่ละหัวข้อ = ผลรวมคะแนนรายวัน
2. คะแนนรายวันเลือกได้ตั้งแต่ -0.50 ถึง 3.00 เพิ่มครั้งละ 0.25
3. คะแนนเฉลี่ย = คะแนนรวม ÷ วันทำงานจริง
4. คะแนนเปอร์เซ็น = `((คะแนนเฉลี่ย - 0.5) / คะแนนเฉลี่ย) × 100`
5. หัวข้อ 1–4 ใช้คะแนนขั้นต่ำ 50 และแบ่งช่วงระหว่างคะแนนขั้นต่ำกับคะแนนสูงสุดเป็น 5 ระดับ Incentive: 60, 70, 80, 90, 100%
6. หัวข้อ 5 ใช้คะแนนพื้นฐาน 1.50 และคะแนนขั้นต่ำ 66.70 โดยค่าเริ่มต้นไม่จัดระดับ Incentive

วันทำงานจริงนับอัตโนมัติจากสถานะ `ทำงาน` และ `ทำงานวันหยุด` และสามารถกำหนดทับเป็นรายคน/รายเดือนได้

---

## ขั้นตอนที่ 1 — สร้าง Google Sheet และ Apps Script

1. สร้าง Google Sheet ใหม่ ตั้งชื่อ เช่น `Service Incentive Database`
2. เปิดเมนู **ส่วนขยาย (Extensions) → Apps Script**
3. ลบโค้ดเดิมใน `Code.gs` แล้ววางโค้ดจากไฟล์ `apps-script/Code.gs`
4. เปิด **Project Settings** และเลือกแสดงไฟล์ manifest จากนั้นแทนที่ `appsscript.json` ด้วยไฟล์ที่ให้มา
5. กด Save
6. เลือกฟังก์ชัน `setup` แล้วกด Run หนึ่งครั้ง
7. อนุญาตสิทธิ์ให้สคริปต์ ระบบจะสร้างชีต:
   - Employees
   - Attendance
   - DailyScores
   - MonthlyOverrides
   - Settings
   - AuditLog

## ขั้นตอนที่ 2 — Deploy Apps Script เป็น Web App

1. กด **Deploy → New deployment**
2. เลือกชนิด **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. กด Deploy และคัดลอก URL ที่ลงท้ายด้วย `/exec`

> เมื่อแก้ไขโค้ด Apps Script ภายหลัง ให้สร้าง deployment เวอร์ชันใหม่ หรือ Edit deployment แล้วเลือก New version

## ขั้นตอนที่ 3 — นำเว็บขึ้น GitHub Pages

1. สร้าง GitHub Repository ใหม่ เช่น `service-incentive`
2. อัปโหลดไฟล์ต่อไปนี้ไว้ที่ root ของ repository:
   - `index.html`
   - `styles.css`
   - `app.js`
3. ไปที่ **Settings → Pages**
4. Source เลือก **Deploy from a branch**
5. Branch เลือก `main` และโฟลเดอร์ `/root`
6. บันทึก แล้วเปิด URL ของ GitHub Pages

## ขั้นตอนที่ 4 — เชื่อมเว็บกับ Google Sheet

1. เปิดเว็บ Service Incentive
2. ไปที่เมนู **ตั้งค่า** และกรอกรหัสผ่าน `Admin1234`
3. วาง Apps Script Web App URL
4. กด **ทดสอบการเชื่อมต่อ**
5. กด **บันทึก URL**

URL จะถูกเก็บไว้ใน localStorage ของเบราว์เซอร์เครื่องนั้น

## การใช้งาน

- **ภาพรวม**: เลือกเดือน ดูคะแนนทั้งหมด เลือกเรียงตามชื่อ/คะแนน/Incentive/วันทำงาน ปรับวันทำงานจริง Export CSV และพิมพ์รายงาน
- **ป้อนข้อมูล**: เลือกวันที่ พนักงาน สถานะ และคะแนน 5 หัวข้อ
- **พนักงาน**: เพิ่ม แก้ไข ลบ และเปิด/ปิดใช้งาน รายชื่อเรียงตามตัวอักษรไทยอัตโนมัติ
- **ตั้งค่า**: ใช้รหัส `Admin1234` เพื่อเปิดหน้าเชื่อม Apps Script หรือกลับไปใช้โหมดทดลอง

## ความปลอดภัยที่แนะนำก่อนใช้งานจริง

เวอร์ชันนี้ตั้งค่า Web App ให้ “Anyone” เพื่อให้ GitHub Pages เรียกใช้งานได้ง่าย จึงควรใช้ URL เฉพาะภายในบริษัทและไม่เผยแพร่ต่อสาธารณะ สำหรับระบบที่ต้องการความปลอดภัยสูงขึ้น ควรเพิ่ม PIN/Token, Google Sign-In หรือวางระบบหลัง Google Workspace ภายในองค์กร


## การอัปเดตจากเวอร์ชันเดิม

1. แทนที่ `index.html`, `styles.css`, `app.js` บน GitHub ด้วยไฟล์เวอร์ชันนี้
2. แทนที่ `Code.gs` ใน Google Apps Script
3. กด **Deploy → Manage deployments → Edit → New version → Deploy** เพื่อให้คำสั่งลบพนักงานและช่วงคะแนนใหม่ทำงาน
4. ไม่ต้องสร้าง Google Sheet ใหม่ และไม่ต้องลบข้อมูลเดิม

> ปุ่มลบพนักงานจะลบทั้งรายชื่อ ข้อมูลการลงเวลา คะแนนรายวัน และการปรับวันทำงานที่เกี่ยวข้อง หลังจากผู้ใช้กดยืนยัน

> รหัสหน้าตั้งค่าเป็นการล็อกฝั่งหน้าเว็บ เหมาะสำหรับป้องกันการกดโดยทั่วไป แต่ไม่ใช่ระบบยืนยันตัวตนระดับสูง เนื่องจากเว็บบน GitHub Pages เป็นไฟล์สาธารณะ หากต้องการใช้งานภายนอกองค์กรควรเพิ่ม Google Sign-In หรือจำกัดการเข้าถึง Apps Script


## Version 2.1

The daily-entry employee selector now includes **All Employees**, which saves the same date, status, five scores, and note to every active employee in one confirmed batch. Existing records for that date are overwritten per employee.
