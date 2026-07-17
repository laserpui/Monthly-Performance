import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from 'file:///C:/Users/Laser%20Pui/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const outputDir = 'outputs';
await fs.mkdir(outputDir, { recursive: true });
const wb = Workbook.create();
const employees = [
  ['emp_พงษ์ศักดิ์','พงษ์ศักดิ์ จักรพิมพ์','พงษ์ศักดิ์','active'],
  ['emp_เอกเลิศ','เอกเลิศ ตันติยมาศ','เอกเลิศ','active'],
  ['emp_สมชาย','สมชาย มูลเงิน','สมชาย','active'],
  ['emp_กันต์ศักดิ์','กันต์ศักดิ์ ฉลาดเฉลียว','กันต์ศักดิ์','active'],
  ['emp_กษิเดช','กษิเดช อิทธิธนาบุญ','กษิเดช','active'],
  ['emp_ประวิทย์','ประวิทย์ ฉลาดเฉลียว','ประวิทย์','active'],
  ['emp_ณัฐพงษ์','ณัฐพงษ์ กลิ่นจันทร์','ณัฐพงษ์','active'],
  ['emp_ชาติชาย','ชาติชาย น่าบัณฑิต','ชาติชาย','active'],
  ['emp_ธนบูรณ์','ธนบูรณ์ ศุภชาติสันติ','ธนบูรณ์','active'],
  ['emp_อภิลักษณ์','อภิลักษณ์ หาไธสง','อภิลักษณ์','active'],
  ['emp_ภาสพงษ์','ภาสพงษ์ คำศรี','ภาสพงษ์','active'],
  ['emp_จีรศักดิ์','จีรศักดิ์ คำศรี','จีรศักดิ์','active'],
];
const criteria = [
  ['c1','ความสามารถในการปฏิบัติงาน',1,3,'active'],
  ['c2','คุณภาพของงาน',2,3,'active'],
  ['c3','ความรับผิดชอบต่อหน้าที่ที่ได้รับมอบหมาย',3,3,'active'],
  ['c4','ความพยายามอุตสาหะในการทำงาน',4,3,'active'],
  ['c5','การเคารพกฎระเบียบของบริษัท',5,3,'active'],
];
function styleSheet(ws, range){
  ws.showGridLines = false;
  ws.getRange(range).format = { fill:'#FFFFFF', font:{ color:'#182033' }, borders:{ preset:'all', style:'thin', color:'#D8E1EF' } };
  ws.getRange(range.split(':')[0].replace(/\d+$/, '1') + ':' + range.split(':')[1].replace(/\d+$/, '1')).format = { fill:'#2563EB', font:{ bold:true, color:'#FFFFFF' } };
  ws.freezePanes.freezeRows(1);
  ws.getUsedRange().format.autofitColumns();
}
const readme = wb.worksheets.add('README');
readme.getRange('A1:D8').values = [
  ['Monthly Evaluation Database','','',''],
  ['Purpose','Google Sheet ฐานข้อมูลสำหรับเว็บประเมินรายวัน โดยคง schema ให้สอดคล้องกับ localStorage เดิม','',''],
  ['Primary key pattern','Entries.entry_key = employee_id|date|criterion_id','',''],
  ['Do not rename','Employees, Criteria, Entries, DayNotes, Settings','',''],
  ['Score values','0–3 เพิ่มครั้งละ 0.25','',''],
  ['Leave statuses','พักร้อน, ลากิจ, ลาป่วย, ชดเชย, วันหยุด','',''],
  ['Default percent mode','original หรือ maxscore','',''],
  ['Created for','ระบบประเมินรายวันพนักงาน','',''],
];
readme.getRange('A1:D1').merge();
readme.getRange('A1').format = { fill:'#2563EB', font:{ bold:true, color:'#FFFFFF', size:16 } };
readme.getRange('A2:D8').format = { fill:'#FFFFFF', borders:{ preset:'all', style:'thin', color:'#D8E1EF' }, wrapText:true };
readme.getRange('A:A').format.font = { bold:true };
readme.getUsedRange().format.autofitColumns();

const settings = wb.worksheets.add('Settings');
settings.getRange('A1:B6').values = [['key','value'],['month','2026-06'],['selectedDate','2026-06-01'],['percentMode','original'],['maxScore',3],['storageKey','monthlyEvalApp.v1']];
styleSheet(settings,'A1:B6');

const emp = wb.worksheets.add('Employees');
emp.getRange('A1:D13').values = [['employee_id','name','short_name','status'],...employees];
styleSheet(emp,'A1:D13');

const crit = wb.worksheets.add('Criteria');
crit.getRange('A1:E6').values = [['criterion_id','name','display_order','max_score','status'],...criteria];
styleSheet(crit,'A1:E6');

const entries = wb.worksheets.add('Entries');
entries.getRange('A1:I2').values = [['entry_key','employee_id','date','criterion_id','value','value_type','month','updated_at','note'],['emp_พงษ์ศักดิ์|2026-06-01|c1','emp_พงษ์ศักดิ์',new Date('2026-06-01'),'c1',1,'score','2026-06','','ตัวอย่างแถวข้อมูล']];
styleSheet(entries,'A1:I2');
entries.getRange('C2:C500').setNumberFormat('yyyy-mm-dd');
entries.getRange('E2:E500').setNumberFormat('0.00');

const notes = wb.worksheets.add('DayNotes');
notes.getRange('A1:D2').values = [['date','month','note','updated_at'],[new Date('2026-06-01'),'2026-06','ตัวอย่างหมายเหตุประจำวัน','']];
styleSheet(notes,'A1:D2');
notes.getRange('A2:A500').setNumberFormat('yyyy-mm-dd');

const summary = wb.worksheets.add('SummaryTemplate');
summary.getRange('A1:H15').values = [
  ['สรุปโครงสร้างฐานข้อมูล','','','','','','',''],
  ['ตาราง','หน้าที่','คีย์หลัก','หมายเหตุ','','','',''],
  ['Employees','รายชื่อพนักงาน','employee_id','ห้ามลบ id หากมีข้อมูลเดิม','','','',''],
  ['Criteria','หัวข้อประเมิน','criterion_id','รองรับเพิ่ม/ลบ/เปลี่ยนชื่อในอนาคต','','','',''],
  ['Entries','คะแนนหรือสถานะรายวัน','entry_key','employee_id|date|criterion_id','','','',''],
  ['DayNotes','หมายเหตุประจำวัน','date','ผูกกับวันที่','','','',''],
  ['Settings','ค่าระบบ','key','ตรงกับเว็บเดิม','','','',''],
  ['','','','','','','',''],
  ['สูตรเปอร์เซ็นต์ legacy','((average - 0.5) / average) * 100','','','','','',''],
  ['สูตรเปอร์เซ็นต์ maxscore','average / maxScore * 100','','','','','',''],
  ['สถานะลา','พักร้อน, ลากิจ, ลาป่วย, ชดเชย, วันหยุด','','','','','',''],
  ['คะแนนมาตรฐาน','1, 1, 1, 1, 1.5','','','','','',''],
  ['','','','','','','',''],
  ['หมายเหตุ','ชีตนี้เป็นฐานข้อมูล/แม่แบบ ไม่เปลี่ยน API เว็บปัจจุบัน','','','','','',''],
  ['','','','','','','',''],
];
summary.getRange('A1:H1').merge();
summary.getRange('A1').format = { fill:'#2563EB', font:{ bold:true, color:'#FFFFFF', size:16 } };
summary.getRange('A2:D14').format = { fill:'#FFFFFF', borders:{ preset:'all', style:'thin', color:'#D8E1EF' }, wrapText:true };
summary.getRange('A2:D2').format = { fill:'#EAF2FF', font:{ bold:true, color:'#182033' } };
summary.getUsedRange().format.autofitColumns();

const errors = await wb.inspect({kind:'match', searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options:{useRegex:true,maxResults:50}, summary:'formula error scan'});
console.log(errors.ndjson);
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(`${outputDir}/monthly-evaluation-database.xlsx`);
console.log('saved outputs/monthly-evaluation-database.xlsx');
