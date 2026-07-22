const SCORE_OPTIONS = Array.from({ length: 15 }, (_, index) => Number((-0.5 + index * 0.25).toFixed(2)));
const ALL_EMPLOYEES_ID = '__ALL_ACTIVE_EMPLOYEES__';
const THAI_COLLATOR = new Intl.Collator('th', { sensitivity: 'base', numeric: true });
const ENTRY_DRAFT_KEY = 'monthlyPerformanceEntryDraftV3';
// Backend หลักของระบบ: ฝังไว้ในโค้ด ไม่อ่านจาก localStorage และไม่ให้เปลี่ยนจากหน้าเว็บ
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbzYA2phGwVxs7frTGSZmZjuxfpc7WAajX87VT4ohgo_jfXTXf88hdAgFQG3ZhjTdVJuMQ/exec';
const API_RETRY_DELAYS_MS = [0, 900, 2200];

const APP = {
  apiUrl: BACKEND_API_URL,
  month: new Date().toISOString().slice(0, 7),
  bootstrap: null,
  editingEntry: null,
  summarySort: localStorage.getItem('monthlyPerformanceSummarySort') || 'nameAsc',
  adminToken: sessionStorage.getItem('monthlyPerformanceAdminToken') || '',
  adminSession: null,
  entrySearch: {
    employeeId: localStorage.getItem('monthlyPerformanceEntryFilterEmployee') || '',
    dateFrom: localStorage.getItem('monthlyPerformanceEntryFilterDateFrom') || '',
    dateTo: localStorage.getItem('monthlyPerformanceEntryFilterDateTo') || '',
    page: 1,
    pageSize: 100,
    results: [],
    total: 0,
  },
  auditRows: [],
  entryDirty: false,
  suppressDraft: false,
};

const CRITERIA_FALLBACK = [
  { id: 'C1', name: 'ความสามารถในการปฏิบัติงาน', normalScore: 1.00, minPercent: 50, rankEnabled: true, allowedScores: SCORE_OPTIONS },
  { id: 'C2', name: 'คุณภาพของงาน', normalScore: 1.00, minPercent: 50, rankEnabled: true, allowedScores: SCORE_OPTIONS },
  { id: 'C3', name: 'ความรับผิดชอบต่องานที่ได้รับมอบหมาย', normalScore: 1.00, minPercent: 50, rankEnabled: true, allowedScores: SCORE_OPTIONS },
  { id: 'C4', name: 'ความพยายามอุตสาหะในการทำงาน', normalScore: 1.00, minPercent: 50, rankEnabled: true, allowedScores: SCORE_OPTIONS },
  { id: 'C5', name: 'การเคารพกฎระเบียบของบริษัท', normalScore: 1.50, minPercent: 66.70, rankEnabled: false, allowedScores: SCORE_OPTIONS },
];

const STATUS_FALLBACK = [
  { id: 'WORK', name: 'ทำงาน', countsAsWork: true, className: 'status-work' },
  { id: 'WEEKEND_WORK', name: 'ทำงานวันหยุด', countsAsWork: true, className: 'status-work' },
  { id: 'SICK_LEAVE', name: 'ลาป่วย', countsAsWork: false, className: 'status-leave' },
  { id: 'PERSONAL_LEAVE', name: 'ลากิจ', countsAsWork: false, className: 'status-leave' },
  { id: 'VACATION', name: 'พักร้อน', countsAsWork: false, className: 'status-leave' },
  { id: 'COMP_OFF', name: 'ชดเชย', countsAsWork: false, className: 'status-off' },
  { id: 'HOLIDAY', name: 'วันหยุด', countsAsWork: false, className: 'status-off' },
];

const DEMO_EMPLOYEES = ['กษิเดช','กันต์ศักดิ์','จีรศักดิ์','ชาติชาย','ณัฐพงษ์','ธนบูรณ์','ประวิทย์','พงษ์ศักดิ์','ภาสพงษ์','สมชาย','อภิลักษณ์','เอกเลิศ']
  .map((name, index) => ({ employeeId: `EMP${String(index + 1).padStart(3, '0')}`, employeeName: name, active: true, department: 'Service', sortOrder: index + 1, deletedAt: '' }));

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}
function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '-';
}
function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${Number(year) + 543}`;
}
function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('th-TH');
}
function getMonthDateRange(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
}
function makeId(prefix = 'ID') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function sortEmployeesByName(list) { return [...list].sort((a, b) => THAI_COLLATOR.compare(a.employeeName || '', b.employeeName || '')); }
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2800);
}
function hasValue(value) { return value !== '' && value !== null && value !== undefined; }
function isAdmin() { return Boolean(APP.adminToken && APP.adminSession); }
function currentMonthStatus() { return APP.bootstrap?.monthStatus?.status || 'OPEN'; }
function isCurrentMonthClosed() { return currentMonthStatus() === 'CLOSED'; }

function demoKey(name) { return `monthlyPerformanceDemo:${name}`; }
function getDemoData(name, fallback) {
  try { return JSON.parse(localStorage.getItem(demoKey(name))) ?? fallback; } catch { return fallback; }
}
function setDemoData(name, value) { localStorage.setItem(demoKey(name), JSON.stringify(value)); }

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function isRetryableApiError(error) {
  const message = String(error?.message || error || '');
  return error instanceof TypeError || /เชื่อมต่อไม่สำเร็จ|Failed to fetch|NetworkError|Load failed|502|503|504/i.test(message);
}

async function fetchApiWithRetry(url, requestPayload) {
  let lastError = null;
  for (let attempt = 0; attempt < API_RETRY_DELAYS_MS.length; attempt += 1) {
    if (API_RETRY_DELAYS_MS[attempt]) await wait(API_RETRY_DELAYS_MS[attempt]);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ payload: JSON.stringify(requestPayload) }),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`เชื่อมต่อไม่สำเร็จ (${response.status})`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (!isRetryableApiError(error) || attempt === API_RETRY_DELAYS_MS.length - 1) break;
    }
  }
  throw lastError || new Error('เชื่อมต่อ Backend ไม่สำเร็จ');
}

async function api(payload) {
  const requestPayload = { ...payload, adminToken: payload.adminToken ?? APP.adminToken };
  const result = await fetchApiWithRetry(APP.apiUrl, requestPayload);
  if (!result?.ok) {
    if (/เซสชันผู้ดูแล/.test(result?.error || '')) clearAdminSession(false);
    throw new Error(result?.error || 'Google Apps Script ส่งข้อผิดพลาดกลับมา');
  }
  return result.data;
}

async function demoApi(payload) {
  const employees = getDemoData('employees', DEMO_EMPLOYEES);
  const entries = getDemoData('entries', []);
  const overrides = getDemoData('overrides', []);
  const monthStatuses = getDemoData('monthStatuses', {});
  const audits = getDemoData('audits', []);
  const requireDemoAdmin = () => { if (payload.adminToken !== 'demo-admin') throw new Error('เซสชันผู้ดูแลหมดอายุ กรุณาเข้าสู่ระบบใหม่'); };
  const pushAudit = row => setDemoData('audits', [{ timestamp: new Date().toISOString(), actor: 'Administrator', ...row }, ...audits].slice(0, 500));

  switch (payload.action) {
    case 'ping': return { message: 'demo-ok', version: '3.0' };
    case 'adminLogin':
      if (payload.password !== 'Admin1234') throw new Error('รหัสผ่านผู้ดูแลไม่ถูกต้อง');
      return { token: 'demo-admin', session: { actor: 'Administrator', expiresAt: new Date(Date.now() + 21600000).toISOString() } };
    case 'adminLogout': return { loggedOut: true };
    case 'getAdminSession': return { authenticated: payload.adminToken === 'demo-admin', session: payload.adminToken === 'demo-admin' ? { actor: 'Administrator' } : null };
    case 'bootstrap': {
      const bootstrap = buildClientBootstrap(payload.monthKey, employees, entries, overrides);
      bootstrap.monthStatus = monthStatuses[payload.monthKey] || { monthKey: payload.monthKey, status: 'OPEN' };
      bootstrap.validation = validateClientMonth(bootstrap);
      bootstrap.admin = { authenticated: payload.adminToken === 'demo-admin', session: payload.adminToken === 'demo-admin' ? { actor: 'Administrator' } : null };
      bootstrap.version = '3.0-demo';
      return bootstrap;
    }
    case 'searchEntries': {
      const filtered = entries
        .filter(item => !payload.employeeId || item.employeeId === payload.employeeId)
        .filter(item => !payload.dateFrom || String(item.date).slice(0, 10) >= payload.dateFrom)
        .filter(item => !payload.dateTo || String(item.date).slice(0, 10) <= payload.dateTo)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return { entries: filtered.slice(0, payload.pageSize || 100), total: filtered.length, page: 1, pageSize: payload.pageSize || 100 };
    }
    case 'saveDailyEntry': {
      const monthKey = payload.entry.date.slice(0, 7);
      if ((monthStatuses[monthKey]?.status || 'OPEN') === 'CLOSED') throw new Error(`เดือน ${monthKey} ถูกปิดแล้ว ไม่สามารถเพิ่มหรือแก้ไขข้อมูลได้`);
      const key = `${payload.entry.date}|${payload.entry.employeeId}`;
      const next = entries.filter(item => `${item.date}|${item.employeeId}` !== key && (!payload.entry.recordId || item.recordId !== payload.entry.recordId));
      next.push({ ...payload.entry, recordId: payload.entry.recordId || makeId('ENTRY'), updatedAt: new Date().toISOString() });
      setDemoData('entries', next);
      pushAudit({ action: 'UPSERT', entity: 'DailyEntry', entityId: key, afterJson: JSON.stringify(payload.entry) });
      return { saved: true };
    }
    case 'saveDailyEntries': {
      let next = [...entries];
      payload.entries.forEach(entry => {
        const monthKey = entry.date.slice(0, 7);
        if ((monthStatuses[monthKey]?.status || 'OPEN') === 'CLOSED') throw new Error(`เดือน ${monthKey} ถูกปิดแล้ว`);
        next = next.filter(item => `${item.date}|${item.employeeId}` !== `${entry.date}|${entry.employeeId}`);
        next.push({ ...entry, recordId: makeId('ENTRY'), updatedAt: new Date().toISOString() });
      });
      setDemoData('entries', next);
      pushAudit({ action: 'BULK_UPSERT', entity: 'DailyEntry', entityId: String(payload.entries.length), metadataJson: JSON.stringify({ count: payload.entries.length }) });
      return { saved: true, savedCount: payload.entries.length };
    }
    case 'saveEmployee': {
      requireDemoAdmin();
      const employee = { ...payload.employee, employeeId: payload.employee.employeeId || makeId('EMP'), deletedAt: payload.employee.deletedAt || '' };
      const next = employees.filter(item => item.employeeId !== employee.employeeId);
      next.push(employee);
      setDemoData('employees', sortEmployeesByName(next));
      pushAudit({ action: 'UPSERT', entity: 'Employee', entityId: employee.employeeId, afterJson: JSON.stringify(employee) });
      return { saved: true, employeeId: employee.employeeId };
    }
    case 'softDeleteEmployee': {
      requireDemoAdmin();
      setDemoData('employees', employees.map(item => item.employeeId === payload.employeeId ? { ...item, active: false, deletedAt: new Date().toISOString(), deletedBy: 'Administrator' } : item));
      pushAudit({ action: 'SOFT_DELETE', entity: 'Employee', entityId: payload.employeeId, metadataJson: JSON.stringify({ reason: payload.reason }) });
      return { deleted: true };
    }
    case 'restoreEmployee': {
      requireDemoAdmin();
      setDemoData('employees', employees.map(item => item.employeeId === payload.employeeId ? { ...item, active: true, deletedAt: '', deletedBy: '' } : item));
      pushAudit({ action: 'RESTORE', entity: 'Employee', entityId: payload.employeeId });
      return { restored: true };
    }
    case 'saveWorkDaysOverride': {
      requireDemoAdmin();
      const next = overrides.filter(item => !(item.monthKey === payload.monthKey && item.employeeId === payload.employeeId));
      if (hasValue(payload.actualWorkDaysOverride)) next.push({ monthKey: payload.monthKey, employeeId: payload.employeeId, actualWorkDaysOverride: Number(payload.actualWorkDaysOverride) });
      setDemoData('overrides', next);
      return { saved: true };
    }
    case 'validateMonth': {
      const bootstrap = buildClientBootstrap(payload.monthKey, employees, entries, overrides);
      return validateClientMonth(bootstrap);
    }
    case 'setMonthStatus': {
      requireDemoAdmin();
      const bootstrap = buildClientBootstrap(payload.monthKey, employees, entries, overrides);
      const validation = validateClientMonth(bootstrap);
      if (payload.status === 'CLOSED' && !validation.passed) throw new Error('ยังปิดเดือนไม่ได้ เพราะพบข้อผิดพลาด');
      monthStatuses[payload.monthKey] = { monthKey: payload.monthKey, status: payload.status, updatedAt: new Date().toISOString(), updatedBy: 'Administrator', notes: payload.reason || '' };
      setDemoData('monthStatuses', monthStatuses);
      pushAudit({ action: 'MONTH_STATUS', entity: 'Month', entityId: payload.monthKey, afterJson: JSON.stringify(monthStatuses[payload.monthKey]) });
      return { saved: true, monthStatus: monthStatuses[payload.monthKey], validation };
    }
    case 'createBackup': requireDemoAdmin(); return { fileId: 'DEMO', fileName: 'Demo Backup', createdAt: new Date().toISOString() };
    case 'getAuditLog': requireDemoAdmin(); return { rows: audits, total: audits.length };
    default: throw new Error(`ไม่รู้จัก action: ${payload.action}`);
  }
}

function round2(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function createIncentiveRange(maxPercent, minPercent = 50) {
  const maxScore = round2(Math.max(minPercent, Number(maxPercent) || minPercent));
  if (maxScore <= minPercent) return { maxScore, step: 0, equalAtBase: true, bands: [{ min: minPercent, max: minPercent, incentive: 60 }] };
  const step = round2((maxScore - minPercent) / 5);
  const bands = [];
  let upper = maxScore;
  [100, 90, 80, 70, 60].forEach(incentive => {
    const lower = round2(upper - step);
    bands.push({ min: lower, max: upper, incentive });
    upper = round2(lower - 0.01);
  });
  return { maxScore, step, equalAtBase: false, bands };
}
function incentiveFromRange(scoreValue, range, hasWorkDays) {
  if (!hasWorkDays) return 0;
  const score = round2(scoreValue);
  if (range.equalAtBase) return score >= 50 ? 60 : 50;
  if (score > range.maxScore) return 100;
  const band = range.bands.find(item => score >= item.min && score <= item.max);
  return band ? band.incentive : 50;
}
function buildClientBootstrap(monthKey, employees, allEntries, allOverrides) {
  const entries = allEntries.filter(item => String(item.date).startsWith(monthKey));
  const overrides = allOverrides.filter(item => item.monthKey === monthKey);
  const calculated = calculateSummary(sortEmployeesByName(employees), entries, overrides, CRITERIA_FALLBACK, STATUS_FALLBACK);
  return { employees: sortEmployeesByName(employees), criteria: CRITERIA_FALLBACK, statuses: STATUS_FALLBACK, entries, overrides, summary: calculated.rows, incentiveRanges: calculated.incentiveRanges };
}
function calculateSummary(employees, entries, overrides, criteria, statuses) {
  const statusMap = Object.fromEntries(statuses.map(status => [status.id, status]));
  const overrideMap = Object.fromEntries(overrides.map(item => [item.employeeId, Number(item.actualWorkDaysOverride)]));
  const employeeIdsWithEntries = new Set(entries.map(entry => entry.employeeId));
  const rows = employees.filter(employee => (!employee.deletedAt && employee.active !== false) || employeeIdsWithEntries.has(employee.employeeId)).map(employee => {
    const employeeEntries = entries.filter(entry => entry.employeeId === employee.employeeId);
    const autoWorkDays = new Set(employeeEntries.filter(entry => statusMap[entry.status]?.countsAsWork).map(entry => entry.date)).size;
    const isOverridden = Number.isFinite(overrideMap[employee.employeeId]);
    const actualWorkDays = isOverridden ? overrideMap[employee.employeeId] : autoWorkDays;
    const offDayEntries = employeeEntries.filter(entry => !statusMap[entry.status]?.countsAsWork && Object.values(entry.scores || {}).some(hasValue));
    const criterionResults = {};
    criteria.forEach(criterion => {
      const totalScore = employeeEntries.reduce((sum, entry) => sum + Number(entry.scores?.[criterion.id] || 0), 0);
      const averageScore = actualWorkDays > 0 ? totalScore / actualWorkDays : 0;
      const performancePercent = averageScore > 0 ? ((averageScore - 0.5) / averageScore) * 100 : 0;
      criterionResults[criterion.id] = { totalScore, averageScore, performancePercent, incentivePercent: null };
    });
    return {
      employeeId: employee.employeeId, employeeName: employee.employeeName, employeeDeleted: Boolean(employee.deletedAt),
      autoWorkDays, actualWorkDays, isOverridden, criteria: criterionResults,
      offDayPerformanceDays: new Set(offDayEntries.map(entry => entry.date)).size,
      offDayPerformanceScore: offDayEntries.reduce((sum, entry) => sum + Object.values(entry.scores || {}).reduce((subtotal, value) => subtotal + Number(value || 0), 0), 0),
    };
  });
  const incentiveRanges = {};
  criteria.filter(criterion => criterion.rankEnabled).forEach(criterion => {
    const values = [criterion.minPercent, ...rows.filter(row => row.actualWorkDays > 0).map(row => round2(row.criteria[criterion.id].performancePercent))];
    const range = createIncentiveRange(Math.max(...values), criterion.minPercent);
    incentiveRanges[criterion.id] = range;
    rows.forEach(row => row.criteria[criterion.id].incentivePercent = incentiveFromRange(row.criteria[criterion.id].performancePercent, range, row.actualWorkDays > 0));
  });
  rows.forEach(row => {
    const performance14 = criteria.filter(c => c.rankEnabled).map(c => row.criteria[c.id].performancePercent);
    const performanceAll = criteria.map(c => row.criteria[c.id].performancePercent);
    const incentives = criteria.filter(c => c.rankEnabled).map(c => row.criteria[c.id].incentivePercent);
    row.overallPerformance14 = performance14.reduce((a, b) => a + b, 0) / performance14.length;
    row.overallPerformance = performanceAll.reduce((a, b) => a + b, 0) / performanceAll.length;
    row.overallIncentive = incentives.reduce((a, b) => a + b, 0) / incentives.length;
  });
  return { rows, incentiveRanges };
}
function validateClientMonth(bootstrap) {
  const issues = [];
  const statusMap = Object.fromEntries((bootstrap.statuses || STATUS_FALLBACK).map(status => [status.id, status]));
  (bootstrap.entries || []).forEach(entry => {
    const values = Object.values(entry.scores || {}).filter(hasValue);
    if (statusMap[entry.status]?.countsAsWork && values.length !== 5) issues.push({ severity: 'ERROR', code: 'WORK_MISSING_SCORES', message: 'สถานะทำงานแต่คะแนนไม่ครบ', details: entry });
    if (!statusMap[entry.status]?.countsAsWork && values.length && !entry.note) issues.push({ severity: 'ERROR', code: 'OFFDAY_SCORE_WITHOUT_NOTE', message: 'คะแนนวันหยุดไม่มีหมายเหตุ', details: entry });
  });
  const counts = { error: issues.filter(i => i.severity === 'ERROR').length, warning: 0, info: 0 };
  return { monthKey: APP.month, checkedAt: new Date().toISOString(), passed: counts.error === 0, counts, totalIssues: issues.length, issues };
}

async function loadApp(showToast = false) {
  setConnectionBadge('loading');
  try {
    APP.bootstrap = await api({ action: 'bootstrap', monthKey: APP.month });
    APP.bootstrap.employees = sortEmployeesByName(APP.bootstrap.employees || []);
    APP.adminSession = APP.bootstrap.admin?.authenticated ? APP.bootstrap.admin.session : null;
    if (!APP.adminSession && APP.adminToken) clearAdminSession(false);
    if (!APP.bootstrap.summary || !APP.bootstrap.incentiveRanges) {
      const calculated = calculateSummary(APP.bootstrap.employees, APP.bootstrap.entries || [], APP.bootstrap.overrides || [], APP.bootstrap.criteria || CRITERIA_FALLBACK, APP.bootstrap.statuses || STATUS_FALLBACK);
      APP.bootstrap.summary = calculated.rows;
      APP.bootstrap.incentiveRanges = calculated.incentiveRanges;
    }
    initializeEntrySearchDefaults();
    await loadEntrySearchResults();
    renderAll();
    setConnectionBadge('live');
    if (showToast) toast('อัปเดตข้อมูลเรียบร้อย');
  } catch (error) {
    console.error(error);
    setConnectionBadge('error');
    toast(error.message);
  }
}

function initializeEntrySearchDefaults(force = false) {
  const range = getMonthDateRange(APP.month);
  if (force || !APP.entrySearch.dateFrom) APP.entrySearch.dateFrom = range.start;
  if (force || !APP.entrySearch.dateTo) APP.entrySearch.dateTo = range.end;
}
function persistEntrySearchFilters() {
  localStorage.setItem('monthlyPerformanceEntryFilterEmployee', APP.entrySearch.employeeId || '');
  localStorage.setItem('monthlyPerformanceEntryFilterDateFrom', APP.entrySearch.dateFrom || '');
  localStorage.setItem('monthlyPerformanceEntryFilterDateTo', APP.entrySearch.dateTo || '');
}
function syncEntryFilterControls() {
  $('#entryEmployeeFilter').value = APP.entrySearch.employeeId || '';
  $('#entryDateFromFilter').value = APP.entrySearch.dateFrom || '';
  $('#entryDateToFilter').value = APP.entrySearch.dateTo || '';
}
async function loadEntrySearchResults() {
  const result = await api({ action: 'searchEntries', employeeId: APP.entrySearch.employeeId, dateFrom: APP.entrySearch.dateFrom, dateTo: APP.entrySearch.dateTo, page: 1, pageSize: APP.entrySearch.pageSize });
  APP.entrySearch.results = Array.isArray(result?.entries) ? result.entries : [];
  APP.entrySearch.total = Number(result?.total ?? APP.entrySearch.results.length);
  persistEntrySearchFilters();
}
async function searchEntries(showToast = false) {
  const dateFrom = $('#entryDateFromFilter').value;
  const dateTo = $('#entryDateToFilter').value;
  if (dateFrom && dateTo && dateFrom > dateTo) return toast('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
  APP.entrySearch.employeeId = $('#entryEmployeeFilter').value || '';
  APP.entrySearch.dateFrom = dateFrom;
  APP.entrySearch.dateTo = dateTo;
  try { await loadEntrySearchResults(); renderEntries(); if (showToast) toast('ค้นหาเรียบร้อย'); } catch (error) { toast(error.message); }
}
function resetEntryFilters() { APP.entrySearch.employeeId = ''; initializeEntrySearchDefaults(true); syncEntryFilterControls(); searchEntries(); }

function setConnectionBadge(mode) {
  const badge = $('#connectionBadge');
  badge.className = 'badge';
  if (mode === 'live') { badge.classList.add('badge-live'); badge.textContent = 'เชื่อม Google Sheet'; }
  else if (mode === 'error') { badge.classList.add('badge-error'); badge.textContent = 'เชื่อมต่อผิดพลาด'; }
  else if (mode === 'loading') { badge.classList.add('badge-demo'); badge.textContent = 'กำลังโหลด…'; }
  else { badge.classList.add('badge-demo'); badge.textContent = 'โหมดทดลอง'; }
}
function renderAll() {
  renderSelectors(); syncEntryFilterControls(); renderCriteriaInputs(); renderAdminAccess(); renderDashboard(); renderEntries(); renderEmployees(); updateEntryLockState();
}
function activeEmployees() { return sortEmployeesByName((APP.bootstrap?.employees || []).filter(employee => employee.active !== false && !employee.deletedAt)); }
function getStatus(id) { return (APP.bootstrap?.statuses || STATUS_FALLBACK).find(status => status.id === id); }
function getEmployee(id) { return (APP.bootstrap?.employees || []).find(employee => employee.employeeId === id); }

function renderSelectors() {
  const employees = activeEmployees();
  const options = employees.map(employee => `<option value="${escapeHtml(employee.employeeId)}">${escapeHtml(employee.employeeName)}</option>`).join('');
  $('#employeeSelect').innerHTML = `<option value="">เลือกพนักงาน</option>${employees.length ? `<option value="${ALL_EMPLOYEES_ID}">★ พนักงานทุกคน (${employees.length} คน)</option><optgroup label="รายบุคคล">${options}</optgroup>` : ''}`;
  const previousFilter = APP.entrySearch.employeeId;
  $('#entryEmployeeFilter').innerHTML = `<option value="">พนักงานทุกคน</option>${sortEmployeesByName(APP.bootstrap?.employees || []).map(employee => `<option value="${escapeHtml(employee.employeeId)}">${escapeHtml(employee.employeeName)}${employee.deletedAt ? ' (ลบแล้ว)' : ''}</option>`).join('')}`;
  $('#entryEmployeeFilter').value = previousFilter;
  $('#statusSelect').innerHTML = (APP.bootstrap?.statuses || STATUS_FALLBACK).map(status => `<option value="${status.id}">${escapeHtml(status.name)}</option>`).join('');
  updateEmployeeSelectionState();
}
function updateEmployeeSelectionState() {
  const isBulk = $('#employeeSelect').value === ALL_EMPLOYEES_ID;
  const count = activeEmployees().length;
  $('#employeeSelectHint').hidden = !isBulk;
  $('#employeeSelectHint').textContent = isBulk ? `ระบบจะบันทึกข้อมูลเดียวกันให้พนักงานที่เปิดใช้งานทั้ง ${count} คน` : '';
  if (isBulk && APP.editingEntry) APP.editingEntry = null;
  updateEntryFormMode();
  if (!APP.editingEntry) $('#entrySubmitBtn').textContent = isBulk ? `บันทึกให้พนักงานทุกคน (${count})` : 'บันทึกข้อมูล';
}
function updateEntryFormMode() {
  const editing = Boolean(APP.editingEntry);
  $('#entryModeBadge').hidden = !editing;
  if (editing) $('#entrySubmitBtn').textContent = 'บันทึกการแก้ไข';
  $('#clearEntryBtn').textContent = editing ? 'ยกเลิกการแก้ไข' : 'ล้างฟอร์ม';
}
function renderCriteriaInputs() {
  const criteria = APP.bootstrap?.criteria || CRITERIA_FALLBACK;
  $('#criteriaInputs').innerHTML = criteria.map((criterion, index) => `
    <label class="criterion-card field">
      <span class="criterion-title">${index + 1}. ${escapeHtml(criterion.name)}</span>
      <select data-criterion="${criterion.id}" required>
        <option value="">เลือกคะแนน</option>
        ${(criterion.allowedScores || SCORE_OPTIONS).map(score => `<option value="${score}" ${Number(score) === Number(criterion.normalScore) ? 'selected' : ''}>${Number(score).toFixed(2)}</option>`).join('')}
      </select>
      <span class="criterion-hint">ช่วง −0.50 ถึง 3.00 · เพิ่มครั้งละ 0.25 · พื้นฐาน ${Number(criterion.normalScore).toFixed(2)}</span>
    </label>`).join('');
  updateScoreDisabledState();
}
function getSortedSummary() {
  const rows = [...(APP.bootstrap?.summary || [])];
  const nameAsc = (a, b) => THAI_COLLATOR.compare(a.employeeName || '', b.employeeName || '');
  const numericSort = (field, direction) => (a, b) => ((Number(a[field]) || 0) - (Number(b[field]) || 0)) * direction || nameAsc(a, b);
  const sorters = { nameAsc, nameDesc: (a, b) => nameAsc(b, a), performanceDesc: numericSort('overallPerformance', -1), performanceAsc: numericSort('overallPerformance', 1), incentiveDesc: numericSort('overallIncentive', -1), workDaysDesc: numericSort('actualWorkDays', -1) };
  return rows.sort(sorters[APP.summarySort] || nameAsc);
}

function renderDashboard() {
  const rawSummary = APP.bootstrap?.summary || [];
  const summary = getSortedSummary();
  const entries = APP.bootstrap?.entries || [];
  const average = rawSummary.length ? rawSummary.reduce((sum, row) => sum + Number(row.overallPerformance14 || 0), 0) / rawSummary.length : 0;
  const incomplete = rawSummary.filter(row => row.actualWorkDays === 0).length;
  const validation = APP.bootstrap?.validation || { counts: { error: 0, warning: 0, info: 0 } };
  $('#kpiGrid').innerHTML = [
    ['พนักงานในรายงาน', rawSummary.length, 'รวมข้อมูลพนักงานย้อนหลัง'],
    ['รายการเดือนนี้', entries.length, APP.month],
    ['เฉลี่ยผลงาน 1–4', `${formatNumber(average)}%`, 'ไม่รวมหัวข้อกฎระเบียบ'],
    ['ข้อผิดพลาด', validation.counts?.error || 0, incomplete ? `${incomplete} คนยังไม่มีวันทำงาน` : 'พร้อมตรวจสอบ'],
  ].map(item => `<article class="kpi"><div class="kpi-label">${item[0]}</div><div class="kpi-value">${item[1]}</div><div class="kpi-foot">${item[2]}</div></article>`).join('');

  renderMonthControl();
  $('#summarySortSelect').value = APP.summarySort;
  const criteria = APP.bootstrap?.criteria || CRITERIA_FALLBACK;
  $('#summaryTable thead').innerHTML = `<tr><th rowspan="2">พนักงาน</th><th rowspan="2" class="center">วันทำงาน</th>${criteria.map((criterion, index) => `<th colspan="${criterion.rankEnabled ? 2 : 1}" class="center">หัวข้อ ${index + 1}</th>`).join('')}<th rowspan="2" class="num">เฉลี่ย 1–4</th><th rowspan="2" class="num">เฉลี่ย 1–5</th><th rowspan="2" class="num">Incentive รวม</th></tr><tr>${criteria.map(criterion => `<th class="num">คะแนน</th>${criterion.rankEnabled ? '<th class="num">Inc.</th>' : ''}`).join('')}</tr>`;
  $('#summaryTable tbody').innerHTML = summary.map(row => `<tr>
    <td><strong>${escapeHtml(row.employeeName)}</strong>${row.employeeDeleted ? '<span class="status-pill status-off mini-pill">ประวัติเดิม</span>' : ''}${row.offDayPerformanceDays ? `<span class="offday-summary" title="คะแนนนอกวันทำงานรวม ${formatNumber(row.offDayPerformanceScore)}">คะแนนวันหยุด ${row.offDayPerformanceDays} วัน</span>` : ''}</td>
    <td class="center">${row.actualWorkDays}${row.isOverridden ? ' <span title="กำหนดเอง">*</span>' : ''}</td>
    ${criteria.map(criterion => { const item = row.criteria[criterion.id]; const cls = item.performancePercent >= criterion.minPercent ? 'score-good' : 'score-low'; return `<td class="num ${cls}">${formatNumber(item.performancePercent)}%</td>${criterion.rankEnabled ? `<td class="num">${Number.isFinite(item.incentivePercent) ? formatNumber(item.incentivePercent, 0) + '%' : '-'}</td>` : ''}`; }).join('')}
    <td class="num"><strong>${formatNumber(row.overallPerformance14)}%</strong></td><td class="num"><strong>${formatNumber(row.overallPerformance)}%</strong></td><td class="num"><strong>${formatNumber(row.overallIncentive, 1)}%</strong></td>
  </tr>`).join('') || '<tr><td colspan="22" class="center muted">ยังไม่มีข้อมูล</td></tr>';
  renderIncentiveRanges();
  renderOverrides();
}

function renderMonthControl() {
  const status = currentMonthStatus();
  const statusMap = {
    OPEN: { label: 'กำลังบันทึก', className: 'month-status-open', description: 'สามารถเพิ่มและแก้ไขข้อมูลได้' },
    REVIEW: { label: 'รอตรวจสอบ', className: 'month-status-review', description: 'อยู่ระหว่างตรวจสอบ แต่ยังแก้ไขข้อมูลได้' },
    CLOSED: { label: 'ปิดเดือนแล้ว', className: 'month-status-closed', description: 'เปิดดูและ Export ได้ แต่ไม่สามารถแก้ไขข้อมูล' },
  };
  const current = statusMap[status] || statusMap.OPEN;
  $('#monthStatusBadge').className = `badge ${current.className}`;
  $('#monthStatusBadge').textContent = current.label;
  $('#monthStatusDescription').textContent = `${current.description}${APP.bootstrap?.monthStatus?.closedAt ? ` · ปิดเมื่อ ${formatDateTime(APP.bootstrap.monthStatus.closedAt)}` : ''}`;
  const validation = APP.bootstrap?.validation || { counts: { error: 0, warning: 0, info: 0 }, checkedAt: '' };
  $('#validationSummary').innerHTML = `
    <div class="validation-stat error"><strong>${validation.counts?.error || 0}</strong><span>ข้อผิดพลาด</span></div>
    <div class="validation-stat warning"><strong>${validation.counts?.warning || 0}</strong><span>คำเตือน</span></div>
    <div class="validation-stat info"><strong>${validation.counts?.info || 0}</strong><span>ข้อมูลประกอบ</span></div>
    <div class="validation-checked">ตรวจล่าสุด ${formatDateTime(validation.checkedAt)}</div>`;
  $('#reviewMonthBtn').hidden = status !== 'OPEN';
  $('#closeMonthBtn').hidden = status === 'CLOSED';
  $('#reopenMonthBtn').hidden = status !== 'CLOSED';
  $$('.admin-action').forEach(button => button.disabled = !isAdmin());
  updateEntryLockState();
}
function renderValidationPanel(validation = APP.bootstrap?.validation) {
  if (!validation) return;
  $('#validationPanel').hidden = false;
  $('#validationTable tbody').innerHTML = (validation.issues || []).map(issue => {
    const details = issue.details || {};
    const employee = getEmployee(details.employeeId)?.employeeName || details.employeeId || '-';
    const date = details.date ? formatDate(details.date) : '-';
    return `<tr><td><span class="severity severity-${String(issue.severity).toLowerCase()}">${escapeHtml(issue.severity)}</span></td><td><strong>${escapeHtml(issue.message)}</strong><div class="muted">${escapeHtml(issue.code)}</div></td><td>${escapeHtml(employee)}<br><span class="muted">${date}</span></td><td><code>${escapeHtml(JSON.stringify(details))}</code></td></tr>`;
  }).join('') || '<tr><td colspan="4" class="center score-good">ไม่พบข้อผิดพลาดหรือคำเตือน</td></tr>';
}
function renderIncentiveRanges() {
  const ranges = APP.bootstrap?.incentiveRanges || {};
  const criteria = (APP.bootstrap?.criteria || CRITERIA_FALLBACK).filter(criterion => criterion.rankEnabled);
  $('#incentiveRangesGrid').innerHTML = criteria.map((criterion, index) => {
    const range = ranges[criterion.id];
    if (!range) return `<article class="range-card"><h3>หัวข้อ ${index + 1}</h3><p class="muted range-empty">ยังไม่มีข้อมูล</p></article>`;
    return `<article class="range-card"><h3>หัวข้อ ${index + 1}: ${escapeHtml(criterion.name)}</h3><table><tbody>${range.bands.map(band => `<tr><td>${formatNumber(band.min)}–${formatNumber(band.max)}</td><td>${band.incentive}%</td></tr>`).join('')}<tr><td>ต่ำกว่าช่วง</td><td>50%</td></tr></tbody></table></article>`;
  }).join('');
}
function renderOverrides() {
  const locked = !isAdmin() || isCurrentMonthClosed();
  $('#overrideGrid').innerHTML = sortEmployeesByName(APP.bootstrap?.summary || []).map(row => `<div class="override-card"><strong>${escapeHtml(row.employeeName)}</strong><div class="override-row"><span class="muted">อัตโนมัติ ${row.autoWorkDays} วัน</span><input type="number" min="0" max="31" placeholder="Auto" value="${row.isOverridden ? row.actualWorkDays : ''}" data-override="${row.employeeId}" ${locked ? 'disabled' : ''}><button class="btn btn-small btn-secondary" data-save-override="${row.employeeId}" type="button" ${locked ? 'disabled' : ''}>บันทึก</button></div></div>`).join('');
}
function renderEntries() {
  syncEntryFilterControls();
  const entries = APP.entrySearch.results || [];
  $('#entryFilterCount').textContent = `แสดง ${entries.length} จาก ${APP.entrySearch.total} รายการ`;
  $('#entriesTable tbody').innerHTML = entries.map(entry => {
    const status = getStatus(entry.status) || { name: entry.status, className: '', countsAsWork: false };
    const criteria = APP.bootstrap?.criteria || CRITERIA_FALLBACK;
    const scoreValues = criteria.map(criterion => entry.scores?.[criterion.id]);
    const hasScores = scoreValues.some(hasValue);
    const scoreText = scoreValues.map(value => hasValue(value) ? Number(value).toFixed(2) : '—').join(', ');
    const offDay = !status.countsAsWork && hasScores;
    const recordKey = entry.recordId || `${entry.date}|${entry.employeeId}`;
    return `<tr><td>${formatDate(entry.date)}</td><td>${escapeHtml(getEmployee(entry.employeeId)?.employeeName || entry.employeeId)}</td><td><span class="status-pill ${status.className || ''}">${escapeHtml(status.name)}</span>${offDay ? '<span class="status-pill offday-badge">มีคะแนนวันหยุด</span>' : ''}</td><td>${hasScores ? scoreText : '-'}</td><td>${escapeHtml(entry.note || '')}</td><td class="entry-actions"><button type="button" class="btn btn-small btn-secondary" data-edit-entry="${escapeHtml(recordKey)}">แก้ไข</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="center muted">ไม่พบรายการตามเงื่อนไข</td></tr>';
}
function renderEmployees() {
  const showDeleted = $('#showDeletedEmployees')?.checked;
  const employees = sortEmployeesByName(APP.bootstrap?.employees || []).filter(employee => showDeleted || !employee.deletedAt);
  const admin = isAdmin();
  $('#employeeAdminNotice').hidden = admin;
  $$('.admin-only-form input, .admin-only-form button').forEach(node => node.disabled = !admin);
  $('#employeesTable tbody').innerHTML = employees.map(employee => {
    const statusText = employee.deletedAt ? 'ลบแบบปลอดภัย' : employee.active !== false ? 'ใช้งาน' : 'ปิดใช้งาน';
    const statusClass = employee.deletedAt ? 'status-deleted' : employee.active !== false ? 'status-work' : 'status-off';
    const actions = employee.deletedAt
      ? `<button type="button" class="btn btn-small btn-secondary" data-restore-employee="${employee.employeeId}" ${admin ? '' : 'disabled'}>กู้คืน</button>`
      : `<button type="button" class="btn btn-small btn-secondary" data-edit-employee="${employee.employeeId}" ${admin ? '' : 'disabled'}>แก้ไข</button><button type="button" class="btn btn-small btn-danger" data-delete-employee="${employee.employeeId}" ${admin ? '' : 'disabled'}>ลบ</button>`;
    return `<tr><td><strong>${escapeHtml(employee.employeeName)}</strong></td><td>${escapeHtml(employee.department || '')}</td><td><span class="status-pill ${statusClass}">${statusText}</span></td><td>${formatDateTime(employee.updatedAt || employee.deletedAt)}</td><td class="employee-actions">${actions}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="center muted">ยังไม่มีรายชื่อพนักงาน</td></tr>';
}

function updateScoreDisabledState() {
  const status = getStatus($('#statusSelect').value);
  const isOffDay = status ? !status.countsAsWork : false;
  $('#offDayPerformanceField').hidden = !isOffDay;
  if (!isOffDay) $('#offDayPerformanceInput').checked = false;
  const allowScores = Boolean(status?.countsAsWork || (isOffDay && $('#offDayPerformanceInput').checked));
  $$('[data-criterion]').forEach(select => {
    select.disabled = !allowScores || isEntryLocked();
    select.required = Boolean(status?.countsAsWork);
    if (!allowScores) select.value = '';
    else if (status?.countsAsWork && !select.value) {
      const criterion = (APP.bootstrap?.criteria || CRITERIA_FALLBACK).find(item => item.id === select.dataset.criterion);
      select.value = criterion?.normalScore ?? '';
    }
  });
}
function isEntryLocked() {
  const date = $('#entryDate')?.value || '';
  return Boolean(isCurrentMonthClosed() && date.startsWith(APP.month));
}
function updateEntryLockState() {
  const locked = isEntryLocked();
  $('#closedMonthEntryNotice').hidden = !locked;
  ['#employeeSelect','#statusSelect','#offDayPerformanceInput','#entryNote','#entrySubmitBtn','#setBaseScoresBtn'].forEach(selector => { const node = $(selector); if (node) node.disabled = locked; });
  updateScoreDisabledState();
}
function setBaseScores() {
  const criteria = APP.bootstrap?.criteria || CRITERIA_FALLBACK;
  $$('[data-criterion]').forEach(select => { const criterion = criteria.find(item => item.id === select.dataset.criterion); if (!select.disabled) select.value = criterion.normalScore; });
  markEntryDirty();
}

function clearEntryForm(removeDraft = true) {
  APP.suppressDraft = true;
  APP.editingEntry = null;
  $('#entryForm').reset();
  $('#entryDate').value = new Date().toISOString().slice(0, 10);
  $('#statusSelect').value = 'WORK';
  $('#offDayPerformanceInput').checked = false;
  renderCriteriaInputs();
  $('#formMessage').textContent = '';
  APP.entryDirty = false;
  $('#draftBadge').hidden = true;
  $('#lastDraftTime').textContent = '';
  if (removeDraft) localStorage.removeItem(ENTRY_DRAFT_KEY);
  APP.suppressDraft = false;
  updateEmployeeSelectionState();
  updateEntryFormMode();
  updateEntryLockState();
}
function openEntry(recordId) {
  const entry = [...(APP.entrySearch.results || []), ...(APP.bootstrap?.entries || [])].find(item => (item.recordId || `${item.date}|${item.employeeId}`) === recordId);
  if (!entry) return;
  APP.suppressDraft = true;
  APP.editingEntry = entry;
  $('#entryDate').value = String(entry.date).slice(0, 10);
  $('#employeeSelect').value = entry.employeeId;
  $('#statusSelect').value = entry.status;
  $('#entryNote').value = entry.note || '';
  const status = getStatus(entry.status);
  $('#offDayPerformanceInput').checked = Boolean(status && !status.countsAsWork && Object.values(entry.scores || {}).some(hasValue));
  updateScoreDisabledState();
  $$('[data-criterion]').forEach(select => select.value = entry.scores?.[select.dataset.criterion] ?? '');
  APP.suppressDraft = false;
  APP.entryDirty = false;
  switchPage('entry');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#formMessage').textContent = `กำลังแก้ไข ${getEmployee(entry.employeeId)?.employeeName || entry.employeeId} วันที่ ${formatDate(entry.date)}`;
  updateEntryFormMode();
  updateEntryLockState();
}
function isValidScore(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= -0.5 && number <= 3 && Math.abs((number + 0.5) / 0.25 - Math.round((number + 0.5) / 0.25)) < 1e-7;
}
function collectEntryForm() {
  const scores = {};
  $$('[data-criterion]').forEach(select => scores[select.dataset.criterion] = select.disabled || select.value === '' ? '' : Number(select.value));
  return { date: $('#entryDate').value, employeeId: $('#employeeSelect').value, status: $('#statusSelect').value, note: $('#entryNote').value.trim(), scores };
}
async function saveEntry(event) {
  event.preventDefault();
  if (isEntryLocked()) return toast('เดือนนี้ปิดแล้ว ไม่สามารถบันทึกข้อมูลได้');
  const form = collectEntryForm();
  const isBulk = form.employeeId === ALL_EMPLOYEES_ID;
  if (!form.date || !form.employeeId) return toast('กรุณาเลือกวันที่และพนักงาน');
  const status = getStatus(form.status);
  const provided = Object.values(form.scores).filter(hasValue);
  if (status?.countsAsWork && provided.length !== 5) return toast('กรุณากรอกคะแนนให้ครบ 5 หัวข้อ');
  if (!status?.countsAsWork && provided.length && !form.note) return toast('กรุณาระบุเหตุผลของคะแนนในวันลา/วันหยุด');
  if (provided.some(value => !isValidScore(value))) return toast('พบคะแนนที่ไม่ถูกต้อง');
  if (provided.some(value => Number(value) < 1 || Number(value) > 1.5) && !form.note) return toast('คะแนนพิเศษหรือต่ำกว่าปกติควรระบุหมายเหตุ');

  const button = $('#entrySubmitBtn');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'กำลังบันทึก…';
  try {
    if (isBulk) {
      const employees = activeEmployees();
      if (!window.confirm(`ยืนยันบันทึกข้อมูลเดียวกันให้พนักงาน ${employees.length} คน วันที่ ${formatDate(form.date)} หรือไม่?`)) return;
      await api({ action: 'saveDailyEntries', entries: employees.map(employee => ({ ...form, employeeId: employee.employeeId, recordId: '' })) });
      toast(`บันทึกให้พนักงาน ${employees.length} คนเรียบร้อย`);
    } else {
      await api({ action: 'saveDailyEntry', entry: { ...form, recordId: APP.editingEntry?.recordId || '' } });
      toast('บันทึกข้อมูลเรียบร้อย');
    }
    APP.month = form.date.slice(0, 7);
    $('#monthPicker').value = APP.month;
    localStorage.removeItem(ENTRY_DRAFT_KEY);
    APP.entryDirty = false;
    await loadApp();
    clearEntryForm();
  } catch (error) {
    $('#formMessage').textContent = error.message;
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
    updateEmployeeSelectionState();
  }
}

function serializeEntryDraft() { return { savedAt: new Date().toISOString(), editingRecordId: APP.editingEntry?.recordId || '', ...collectEntryForm(), offDayPerformance: $('#offDayPerformanceInput').checked }; }
function markEntryDirty() {
  if (APP.suppressDraft) return;
  APP.entryDirty = true;
  $('#draftBadge').hidden = false;
  const draft = serializeEntryDraft();
  localStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify(draft));
  $('#lastDraftTime').textContent = `บันทึกร่าง ${new Date(draft.savedAt).toLocaleTimeString('th-TH')}`;
}
function restoreEntryDraft() {
  const raw = localStorage.getItem(ENTRY_DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (!draft.savedAt || Date.now() - new Date(draft.savedAt).getTime() > 7 * 86400000) return localStorage.removeItem(ENTRY_DRAFT_KEY);
    APP.suppressDraft = true;
    $('#entryDate').value = draft.date || $('#entryDate').value;
    $('#employeeSelect').value = draft.employeeId || '';
    $('#statusSelect').value = draft.status || 'WORK';
    $('#entryNote').value = draft.note || '';
    $('#offDayPerformanceInput').checked = Boolean(draft.offDayPerformance);
    updateScoreDisabledState();
    $$('[data-criterion]').forEach(select => { if (hasValue(draft.scores?.[select.dataset.criterion])) select.value = draft.scores[select.dataset.criterion]; });
    APP.suppressDraft = false;
    APP.entryDirty = true;
    $('#draftBadge').hidden = false;
    $('#lastDraftTime').textContent = `กู้คืนร่าง ${formatDateTime(draft.savedAt)}`;
  } catch { localStorage.removeItem(ENTRY_DRAFT_KEY); }
}

function resetEmployeeForm() {
  $('#employeeForm').reset(); $('#employeeIdInput').value = ''; $('#employeeDepartmentInput').value = 'Service'; $('#employeeActiveInput').checked = true; $('#cancelEmployeeEditBtn').hidden = true;
}
async function saveEmployee(event) {
  event.preventDefault();
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  const employee = { employeeId: $('#employeeIdInput').value, employeeName: $('#employeeNameInput').value.trim(), department: $('#employeeDepartmentInput').value.trim(), active: $('#employeeActiveInput').checked };
  if (!employee.employeeName) return toast('กรุณาระบุชื่อพนักงาน');
  try { await api({ action: 'saveEmployee', employee }); resetEmployeeForm(); await loadApp(); toast(employee.employeeId ? 'แก้ไขพนักงานแล้ว' : 'เพิ่มพนักงานแล้ว'); } catch (error) { toast(error.message); }
}
function editEmployee(employeeId) {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  const employee = getEmployee(employeeId); if (!employee || employee.deletedAt) return;
  $('#employeeIdInput').value = employee.employeeId; $('#employeeNameInput').value = employee.employeeName; $('#employeeDepartmentInput').value = employee.department || ''; $('#employeeActiveInput').checked = employee.active !== false; $('#cancelEmployeeEditBtn').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function softDeleteEmployee(employeeId) {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  const employee = getEmployee(employeeId); if (!employee) return;
  const reason = window.prompt(`ลบ “${employee.employeeName}” แบบปลอดภัย\nข้อมูลย้อนหลังจะยังอยู่ครบ กรุณาระบุเหตุผล:`);
  if (reason === null) return;
  try { await api({ action: 'softDeleteEmployee', employeeId, reason }); await loadApp(); toast('ลบพนักงานแบบปลอดภัยแล้ว'); } catch (error) { toast(error.message); }
}
async function restoreEmployee(employeeId) {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  if (!window.confirm('ยืนยันการกู้คืนพนักงานและเปิดใช้งานอีกครั้งหรือไม่?')) return;
  try { await api({ action: 'restoreEmployee', employeeId }); await loadApp(); toast('กู้คืนพนักงานแล้ว'); } catch (error) { toast(error.message); }
}
async function saveOverride(employeeId) {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  const input = document.querySelector(`[data-override="${employeeId}"]`);
  try { await api({ action: 'saveWorkDaysOverride', monthKey: APP.month, employeeId, actualWorkDaysOverride: input.value }); await loadApp(); toast('ปรับวันทำงานจริงแล้ว'); } catch (error) { toast(error.message); }
}

async function validateMonthAction(showPanel = true) {
  const button = $('#validateMonthBtn');
  const original = button.textContent; button.disabled = true; button.textContent = 'กำลังตรวจ…';
  try { const validation = await api({ action: 'validateMonth', monthKey: APP.month }); APP.bootstrap.validation = validation; renderMonthControl(); if (showPanel) renderValidationPanel(validation); toast(validation.passed ? 'ตรวจสอบแล้ว ไม่พบข้อผิดพลาด' : `พบข้อผิดพลาด ${validation.counts.error} รายการ`); return validation; }
  catch (error) { toast(error.message); return null; }
  finally { button.disabled = false; button.textContent = original; }
}
async function changeMonthStatus(status) {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  let reason = '';
  if (status === 'CLOSED') {
    const validation = await validateMonthAction(true); if (!validation?.passed) return;
    if (!window.confirm(`ยืนยันปิดเดือน ${APP.month} หรือไม่?\nระบบจะสำรอง Google Sheet ก่อนปิดเดือน`)) return;
  } else if (status === 'REVIEW') {
    if (!window.confirm(`ส่งเดือน ${APP.month} เข้าสถานะรอตรวจสอบหรือไม่?`)) return;
  } else if (status === 'OPEN') {
    reason = window.prompt('กรุณาระบุเหตุผลในการเปิดเดือนกลับมาแก้ไข:') || '';
    if (!reason) return toast('ต้องระบุเหตุผลในการเปิดเดือน');
  }
  try { const result = await api({ action: 'setMonthStatus', monthKey: APP.month, status, reason }); APP.bootstrap.monthStatus = result.monthStatus; APP.bootstrap.validation = result.validation; renderDashboard(); toast(status === 'CLOSED' ? 'ปิดเดือนและสำรองข้อมูลแล้ว' : 'เปลี่ยนสถานะเดือนแล้ว'); }
  catch (error) { toast(error.message); }
}

function exportCsv() {
  const criteria = APP.bootstrap?.criteria || CRITERIA_FALLBACK;
  const headers = ['Employee','ActualWorkDays', ...criteria.flatMap(c => [c.name, ...(c.rankEnabled ? [`Incentive ${c.id}`] : [])]), 'OverallPerformance1to4','OverallPerformance1to5','OverallIncentive'];
  const rows = getSortedSummary().map(row => [row.employeeName, row.actualWorkDays, ...criteria.flatMap(c => [row.criteria[c.id].performancePercent, ...(c.rankEnabled ? [row.criteria[c.id].incentivePercent] : [])]), row.overallPerformance14, row.overallPerformance, row.overallIncentive]);
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `monthly-performance-${APP.month}.csv`; link.click(); URL.revokeObjectURL(url);
}

function renderAdminAccess() {
  const admin = isAdmin();
  $('#adminGate').hidden = admin;
  $('#settingsContent').hidden = !admin;
  $('#adminBadge').className = `badge ${admin ? 'badge-admin' : 'badge-locked'}`;
  $('#adminBadge').textContent = admin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้ทั่วไป';
  $('#adminSessionText').textContent = admin ? `เข้าสู่ระบบ: ${APP.adminSession.actor || 'Administrator'} · หมดอายุ ${formatDateTime(APP.adminSession.expiresAt)}` : '';
  $('#auditLockedNotice').hidden = admin;
  $('#auditContent').hidden = !admin;
  $$('.admin-action').forEach(button => button.disabled = !admin);
}
async function loginAdmin(event) {
  event.preventDefault();
  const password = $('#adminPasswordInput').value;
  $('#adminLoginMessage').textContent = 'กำลังตรวจสอบ…';
  try {
    const result = await api({ action: 'adminLogin', password, adminToken: '' });
    APP.adminToken = result.token; APP.adminSession = result.session;
    sessionStorage.setItem('monthlyPerformanceAdminToken', APP.adminToken);
    $('#adminPasswordInput').value = ''; $('#adminLoginMessage').textContent = '';
    await loadApp(); switchPage('settings'); toast('เข้าสู่ระบบผู้ดูแลแล้ว');
  } catch (error) { $('#adminLoginMessage').textContent = error.message; }
}
function clearAdminSession(showToast = true) {
  APP.adminToken = ''; APP.adminSession = null; sessionStorage.removeItem('monthlyPerformanceAdminToken'); renderAdminAccess(); renderEmployees(); renderOverrides(); if (showToast) toast('ออกจากระบบผู้ดูแลแล้ว');
}
async function logoutAdmin() { try { await api({ action: 'adminLogout' }); } catch {} clearAdminSession(); }
async function backupNow() {
  if (!isAdmin()) return toast('กรุณาเข้าสู่ระบบผู้ดูแล');
  const note = window.prompt('ระบุชื่อหรือเหตุผลของการสำรองข้อมูล:', 'Manual backup'); if (note === null) return;
  try { const result = await api({ action: 'createBackup', note }); toast(`สำรองข้อมูลแล้ว: ${result.fileName}`); } catch (error) { toast(error.message); }
}

async function loadAudit() {
  if (!isAdmin()) return;
  try {
    const result = await api({ action: 'getAuditLog', monthKey: $('#auditMonthFilter').value, auditAction: $('#auditActionFilter').value, limit: 150 });
    APP.auditRows = result.rows || [];
    renderAudit();
  } catch (error) { toast(error.message); }
}
function compactJson(value) {
  if (!value) return '-';
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
function jsonDetails(value, label) {
  if (!value) return '-';
  const text = compactJson(value);
  return `<details><summary>${label}</summary><pre>${escapeHtml(text)}</pre></details>`;
}
function renderAudit() {
  $('#auditTable tbody').innerHTML = APP.auditRows.map(row => `<tr><td>${formatDateTime(row.timestamp)}</td><td><span class="audit-action">${escapeHtml(row.action)}</span></td><td>${escapeHtml(row.entity)}<br><span class="muted">${escapeHtml(row.entityId)}</span></td><td>${escapeHtml(row.actor || '-')}</td><td>${jsonDetails(row.beforeJson, 'ดูค่าเดิม')}</td><td>${jsonDetails(row.afterJson || row.metadataJson || row.payload, 'ดูค่าใหม่/รายละเอียด')}</td></tr>`).join('') || '<tr><td colspan="6" class="center muted">ยังไม่มีประวัติ</td></tr>';
}

function switchPage(page) {
  $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  $$('.page').forEach(section => section.classList.toggle('active', section.id === `page-${page}`));
  if (page === 'settings') renderAdminAccess();
  if (page === 'audit' && isAdmin()) loadAudit();
}

function bindEvents() {
  $$('.tab').forEach(button => button.addEventListener('click', () => switchPage(button.dataset.page)));
  $('#monthPicker').addEventListener('change', async event => { APP.month = event.target.value; initializeEntrySearchDefaults(true); await loadApp(); });
  $('#summarySortSelect').addEventListener('change', event => { APP.summarySort = event.target.value; localStorage.setItem('monthlyPerformanceSummarySort', APP.summarySort); renderDashboard(); });
  $('#refreshBtn').addEventListener('click', () => loadApp(true));
  $('#statusSelect').addEventListener('change', () => { updateScoreDisabledState(); markEntryDirty(); });
  $('#offDayPerformanceInput').addEventListener('change', () => { updateScoreDisabledState(); markEntryDirty(); });
  $('#employeeSelect').addEventListener('change', () => { updateEmployeeSelectionState(); markEntryDirty(); });
  $('#entryDate').addEventListener('change', () => { updateEntryLockState(); markEntryDirty(); });
  $('#entryForm').addEventListener('input', markEntryDirty);
  $('#entryForm').addEventListener('submit', saveEntry);
  $('#clearEntryBtn').addEventListener('click', () => clearEntryForm());
  $('#setBaseScoresBtn').addEventListener('click', setBaseScores);
  $('#employeeForm').addEventListener('submit', saveEmployee);
  $('#cancelEmployeeEditBtn').addEventListener('click', resetEmployeeForm);
  $('#showDeletedEmployees').addEventListener('change', renderEmployees);
  $('#exportCsvBtn').addEventListener('click', exportCsv);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#entryEmployeeFilter').addEventListener('change', () => searchEntries());
  $('#entryDateFromFilter').addEventListener('change', () => searchEntries());
  $('#entryDateToFilter').addEventListener('change', () => searchEntries());
  $('#searchEntryFiltersBtn').addEventListener('click', () => searchEntries(true));
  $('#clearEntryFiltersBtn').addEventListener('click', resetEntryFilters);
  $('#entriesTable').addEventListener('click', event => { const button = event.target.closest('[data-edit-entry]'); if (button) openEntry(button.dataset.editEntry); });
  $('#employeesTable').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-employee]'); const remove = event.target.closest('[data-delete-employee]'); const restore = event.target.closest('[data-restore-employee]');
    if (edit) editEmployee(edit.dataset.editEmployee); if (remove) softDeleteEmployee(remove.dataset.deleteEmployee); if (restore) restoreEmployee(restore.dataset.restoreEmployee);
  });
  $('#overrideGrid').addEventListener('click', event => { const button = event.target.closest('[data-save-override]'); if (button) saveOverride(button.dataset.saveOverride); });
  $('#validateMonthBtn').addEventListener('click', () => validateMonthAction(true));
  $('#reviewMonthBtn').addEventListener('click', () => changeMonthStatus('REVIEW'));
  $('#closeMonthBtn').addEventListener('click', () => changeMonthStatus('CLOSED'));
  $('#reopenMonthBtn').addEventListener('click', () => changeMonthStatus('OPEN'));
  $('#hideValidationBtn').addEventListener('click', () => $('#validationPanel').hidden = true);
  $('#adminLoginForm').addEventListener('submit', loginAdmin);
  $('#adminLogoutBtn').addEventListener('click', logoutAdmin);
  $('#backupNowBtn').addEventListener('click', backupNow);
  $('#refreshAuditBtn').addEventListener('click', loadAudit);
  $('#searchAuditBtn').addEventListener('click', loadAudit);
  $('#testBackendBtn').addEventListener('click', async () => {
    setConnectionBadge('loading');
    try {
      const result = await api({ action: 'ping' });
      setConnectionBadge('live');
      toast(`เชื่อมต่อ Backend สำเร็จ${result.version ? ` · V${result.version}` : ''}`);
    } catch (error) {
      setConnectionBadge('error');
      toast(error.message || 'เชื่อมต่อ Backend ไม่สำเร็จ');
    }
  });
  window.addEventListener('beforeunload', event => { if (!APP.entryDirty) return; event.preventDefault(); event.returnValue = ''; });
}

async function init() {
  $('#monthPicker').value = APP.month;
  $('#entryDate').value = new Date().toISOString().slice(0, 10);
  $('#summarySortSelect').value = APP.summarySort;
  $('#auditMonthFilter').value = APP.month;
  bindEvents();
  await loadApp();
  clearEntryForm(false);
  restoreEntryDraft();
  resetEmployeeForm();
}

document.addEventListener('DOMContentLoaded', init);
