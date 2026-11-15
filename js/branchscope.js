/* สาขาที่กำลังดู (แทน setBranch/restoreBranch ใน core.js)
 * - ดูแลหลายสาขา (Owner/Admin/HR/Manager หลายสาขา): เข้าระบบทุกครั้งเริ่มที่ "ทุกสาขา" เสมอ
 *   เลือกสาขาแล้วจำไว้เฉพาะการเข้าระบบครั้งนั้น (กด F5 ยังอยู่สาขาเดิม) ไม่ค้างข้ามการเข้าระบบหรือข้ามผู้ใช้ในเครื่องเดียวกัน
 * - ดูแลสาขาเดียว: ล็อกอยู่สาขาของตัวเองเท่านั้น เลือกสาขาอื่นไม่ได้
 * - สาขาที่ไม่อยู่ในสิทธิ์ของตัวเอง ใช้ไม่ได้ (Google ไม่ส่งข้อมูลสาขาอื่นมาอยู่แล้ว และไม่ให้บันทึกข้ามสาขา) */
'use strict';
const brKey = () => 'amz.br.' + (S.token || '').slice(0, 16);
window.setBranch = function (c) {
  if (c && !myBranches().some(b => b.code === c)) c = multiBranch() ? '' : oneBranchOf();
  if (!multiBranch()) c = oneBranchOf();
  S.branch = c;
  try { sessionStorage.setItem(brKey(), c); } catch (e) { /* ignore */ }
  S.f.pending = {}; S.f.patPend = {}; S.rev++;
};
window.restoreBranch = function () {
  if (!multiBranch()) { S.branch = oneBranchOf(); return; }
  let c = null;
  try { c = sessionStorage.getItem(brKey()); } catch (e) { /* ignore */ }
  S.branch = c && myBranches().some(b => b.code === c) ? c : '';
};
function oneBranchOf() { return ((openBranches()[0] || myBranches()[0]) || {}).code || ''; }
