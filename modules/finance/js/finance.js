(function(){
'use strict';
const app=document.getElementById('financeApp');
if(!app)return;
const content=document.getElementById('fmContent');
const crumb=document.getElementById('fmCrumb');
const sidebar=document.getElementById('fmSidebar');
const backdrop=document.getElementById('fmBackdrop');
const labels={dashboard:'ภาพรวม',company:'ข้อมูลบริษัท',revenue:'รายรับ / ลูกหนี้',expenses:'รายจ่าย / เจ้าหนี้',partners:'คู่ค้า',accounts:'ผังบัญชี',payments:'การชำระเงิน',vat:'ภาษีมูลค่าเพิ่ม (VAT)',wht:'ภาษีหัก ณ ที่จ่าย',filing:'ยื่นแบบภาษี',calendar:'ปฏิทินภาษี',ledger:'บัญชีแยกประเภท',journals:'สมุดรายวัน',statements:'งบการเงิน',assets:'สินทรัพย์ถาวร',payroll:'เงินเดือนและภาษีบุคคล',documents:'คลังเอกสาร',integrations:'เชื่อมต่อระบบ',audit:'ประวัติการทำรายการ',settings:'ตั้งค่า'};
function closeMenu(){sidebar.classList.remove('open');backdrop.classList.remove('show');}
async function showPage(key){
 const title=labels[key]||labels.dashboard;
 crumb.textContent=title;
 document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===key));
 if(key==='dashboard'){renderDashboard();return;}
 if(['company','partners','accounts'].includes(key)){content.innerHTML='<div class="fm-panel" style="padding:28px">กำลังโหลด…</div>';if(!window.FinanceMasterData){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/finance-master-data.js?v=0.1.0';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}window.FinanceMasterData.render(key,content);location.hash=key;closeMenu();return;}
 content.innerHTML='<div class="fm-page-head"><div><div class="fm-eyebrow">FINANCE WORKSPACE</div><h1>'+title+'</h1><p>พื้นที่ทำงานสำหรับ'+title+' เชื่อมโยงข้อมูลด้วยรหัสธุรกรรมเดียว</p></div><span class="fm-preview-tag">PREVIEW ONLY</span></div><div class="fm-notice"><span>ⓘ</span><div><b>โมดูลอยู่ระหว่างพัฒนา</b><small>หน้านี้เป็นโครงสร้างนำทางเท่านั้น ยังไม่มีการอ่านหรือบันทึกข้อมูลจริง</small></div></div><section class="fm-panel" style="min-height:260px;display:grid;place-content:center;text-align:center;gap:9px"><div class="fm-chart-icon" style="margin:auto">▧</div><b style="font-size:14px;color:#385345">เตรียมพื้นที่ '+title+'</b><span style="font-size:11px;color:#87958c">จะเปิดใช้งานหลังตรวจสอบสิทธิ์ ฐานข้อมูล และการทดสอบความปลอดภัย</span><button class="fm-btn fm-btn-light" id="fmBackDash" style="margin:10px auto 0">กลับภาพรวม</button></section><footer class="fm-footer">CMS Finance & Accounting • Isolated module • Build 0.1.0</footer>';
 document.getElementById('fmBackDash').addEventListener('click',()=>{location.hash='';renderDashboard();});
 location.hash=key;closeMenu();
}
function renderDashboard(){location.hash='';location.reload();}
document.addEventListener('click',e=>{
 const toggle=e.target.closest('.fm-group-toggle');
 if(toggle){const target=document.getElementById(toggle.getAttribute('aria-controls'));const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));target.hidden=open;const c=toggle.querySelector('.fm-chevron');if(c)c.textContent=open?'›':'⌄';return;}
 const page=e.target.closest('[data-page]');if(page){e.preventDefault();showPage(page.dataset.page);return;}
 const exportBtn=e.target.closest('[data-action="export"]');if(exportBtn){window.alert('โหมดตัวอย่าง: ยังไม่มีข้อมูลให้ส่งออก');return;}
});
document.getElementById('fmMenuBtn').addEventListener('click',()=>{sidebar.classList.add('open');backdrop.classList.add('show');});
backdrop.addEventListener('click',closeMenu);
if(location.hash&&labels[location.hash.slice(1)])showPage(location.hash.slice(1));
})();