(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(Number(n)||0);
const field=(label,name,type='text',required=false,placeholder='')=>'<label class="fm-field"><span>'+label+(required?' <i>*</i>':'')+'</span><input name="'+name+'" type="'+type+'" '+(required?'required':'')+' placeholder="'+placeholder+'"></label>';
function render(kind,root){
 if(kind==='payments'){
  root.innerHTML='<div class="fm-page-head"><div><div class="fm-eyebrow">CASH MANAGEMENT · PAYMENT CONTROL</div><h1>การชำระเงิน</h1><p>บันทึกรายการรับ/จ่ายเงิน พร้อมขั้นตอน Maker–Checker และประวัติอนุมัติ</p></div><span class="fm-status-pill">LIVE DATA</span></div><div class="fm-notice"><span>ⓘ</span><div><b>รายการทดสอบ UAT</b><small>รายการที่บันทึกเป็นข้อมูลทดสอบ ไม่ใช่หลักฐานการรับหรือจ่ายเงินจริง</small></div></div><section class="fm-panel"><div class="fm-filter-row"><select id="fmPaymentFilter"><option value="">ทุกรายการ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="paid">ชำระแล้ว</option><option value="rejected">ไม่อนุมัติ</option></select><button class="fm-btn fm-btn-primary" id="fmPaymentAdd">＋ บันทึกรายการรับ/จ่าย</button></div><div class="fm-table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>จำนวนเงิน</th><th>ช่องทาง</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead><tbody id="fmPaymentRows"><tr><td colspan="6" class="fm-empty-cell">กำลังโหลด…</td></tr></tbody></table></div></section><div class="fm-modal" id="fmPaymentModal" hidden><div class="fm-modal-card"><div class="fm-panel-head"><div><h2>บันทึกรายการรับ/จ่ายเงิน</h2><p>ระบบจะสร้างรายการสถานะรออนุมัติ</p></div><button class="fm-icon-close" type="button" data-close>×</button></div><form id="fmPaymentForm" class="fm-form-grid"><label class="fm-field"><span>ประเภทรายการ</span><select name="payment_type"><option value="receipt">รับเงิน</option><option value="disbursement">จ่ายเงิน</option><option value="refund">คืนเงิน</option></select></label><label class="fm-field"><span>วันที่</span><input name="payment_date" type="date" required></label><label class="fm-field"><span>จำนวนเงิน (บาท)</span><input name="amount" type="number" min="0.01" step="0.01" required></label><label class="fm-field"><span>ช่องทาง</span><select name="method"><option value="cash">เงินสด</option><option value="bank_transfer">โอนธนาคาร</option><option value="credit_card">บัตรเครดิต</option><option value="cheque">เช็ค</option><option value="other">อื่น ๆ</option></select></label><label class="fm-field"><span>เลขที่อ้างอิง</span><input name="reference_number" maxlength="120"></label><label class="fm-field"><span>Document ID (ถ้ามี)</span><input name="document_id" placeholder="UUID เอกสารที่อนุมัติแล้ว"></label><label class="fm-field fm-field-full"><span>หมายเหตุ</span><textarea name="note" rows="2"></textarea></label><div class="fm-form-actions"><button type="button" class="fm-btn fm-btn-light" data-close>ยกเลิก</button><button type="submit" class="fm-btn fm-btn-primary">บันทึกรายการ UAT</button></div></form><div class="fm-inline-result" id="fmPaymentResult" role="status"></div></div></div>';
  const $=id=>root.querySelector('#'+id), body=$('fmPaymentRows'), modal=$('fmPaymentModal'), form=$('fmPaymentForm');
  const close=()=>modal.hidden=true;
  root.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  $('fmPaymentAdd').onclick=()=>{form.elements.payment_date.value=new Date().toISOString().slice(0,10);modal.hidden=false};
  async function load(){
   body.innerHTML='<tr><td colspan="6" class="fm-empty-cell">กำลังโหลด…</td></tr>';
   try{
    const query=$('fmPaymentFilter').value, result=await window.FinanceAuth.request('payments');
    const items=(result.items||[]).filter(row=>!query||row.status===query);
    if(!items.length){body.innerHTML='<tr><td colspan="6" class="fm-empty-cell">ยังไม่มีรายการชำระเงิน</td></tr>';return}
    body.innerHTML='';
    items.forEach(row=>{
     const tr=document.createElement('tr');
     const vals=[row.payment_date,row.payment_type==='receipt'?'รับเงิน':row.payment_type==='refund'?'คืนเงิน':'จ่ายเงิน',money(row.amount),row.method,row.status];
     vals.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');tr.appendChild(td)});
     const td=document.createElement('td');
     if(row.status==='pending'){const b=document.createElement('button');b.className='fm-btn fm-btn-light';b.textContent='อนุมัติ';b.onclick=()=>act('payment.approve',{payment_id:row.id});td.appendChild(b)}
     else if(row.status==='approved'){const b=document.createElement('button');b.className='fm-btn fm-btn-light';b.textContent='ยืนยันชำระแล้ว';b.onclick=()=>act('payment.mark-paid',{payment_id:row.id});td.appendChild(b)}
     else td.textContent='—';
     tr.appendChild(td);body.appendChild(tr);
    });
   }catch(err){body.innerHTML='';const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='fm-empty-cell';td.textContent=err.message||'โหลดข้อมูลไม่สำเร็จ';tr.appendChild(td);body.appendChild(tr)}
  }
  async function act(action,payload){try{await window.FinanceAuth.request(action,{method:'POST',body:payload});await load()}catch(err){alert(err.message||'ดำเนินการไม่สำเร็จ')}}
  $('fmPaymentFilter').onchange=load;
  form.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));const out=$('fmPaymentResult');out.textContent='กำลังบันทึก…';try{await window.FinanceAuth.request('payment.create',{method:'POST',body:d,idempotencyKey:crypto.randomUUID()});out.textContent='บันทึกรายการ UAT แล้ว และส่งรออนุมัติ';form.reset();close();await load()}catch(err){out.textContent=err.message||'บันทึกไม่สำเร็จ';out.classList.add('error')}};
  load();return;
 }
 const cfg={
 revenue:{eyebrow:'TRANSACTION · ACCOUNTS RECEIVABLE',title:'รายรับ / ลูกหนี้',desc:'บันทึกใบแจ้งหนี้ ใบเสร็จรับเงิน และติดตามยอดค้างชำระ',doc:'invoice',counter:'ลูกค้า'},
 expenses:{eyebrow:'TRANSACTION · ACCOUNTS PAYABLE',title:'รายจ่าย / เจ้าหนี้',desc:'บันทึกค่าใช้จ่าย ใบรับสินค้า และยอดเจ้าหนี้',doc:'expense',counter:'ผู้ขาย'},
 payments:{eyebrow:'CASH MANAGEMENT · PAYMENT VOUCHER',title:'การชำระเงิน',desc:'จัดทำใบสำคัญจ่าย ติดตามการอนุมัติ และกระทบยอดการชำระ',doc:'payment',counter:'ผู้รับเงิน'}
 }[kind];
 root.innerHTML='<div class="fm-page-head"><div><div class="fm-eyebrow">'+cfg.eyebrow+'</div><h1>'+cfg.title+'</h1><p>'+cfg.desc+'</p></div><span class="fm-preview-tag">PREVIEW ONLY</span></div><div class="fm-notice"><span>ⓘ</span><div><b>แบบฟอร์มเตรียมทดสอบ</b><small>ตรวจสอบข้อมูลและคำนวณยอดได้ แต่ยังไม่บันทึกลงฐานข้อมูลหรือส่งอนุมัติ จนกว่า Finance API จะผ่านการทดสอบสิทธิ์และเชื่อมต่อฐานข้อมูล</small></div></div><section class="fm-panel fm-form-panel"><div class="fm-panel-head"><div><h2>รายละเอียดเอกสาร</h2><p>ทุกเอกสารจะมี Transaction ID กลางเมื่อเปิดใช้งานจริง</p></div><span class="fm-status-pill">Draft · Local</span></div><form id="fmTxnForm" class="fm-form-grid">'+field('วันที่เอกสาร','document_date','date',true)+field('วันครบกำหนด','due_date','date')+field('เลขที่อ้างอิง','reference_no','text',false,'เลขที่เอกสารจากต้นทาง')+'<label class="fm-field"><span>ชื่อ'+cfg.counter+' <i>*</i></span><select name="partner_id" required><option value="">กำลังโหลดทะเบียนคู่ค้า…</option></select></label><label class="fm-field"><span>สาขา</span><select name="branch_type"><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></label><label class="fm-field"><span>ประเภทภาษี</span><select name="vat_rate"><option value="7">VAT 7%</option><option value="0">VAT 0%</option><option value="exempt">ยกเว้น VAT</option><option value="none">ไม่อยู่ในระบบ VAT</option></select></label><label class="fm-field"><span>หัก ณ ที่จ่าย</span><select name="wht_rate"><option value="0">ไม่หัก</option><option value="1">1%</option><option value="2">2%</option><option value="3">3%</option><option value="5">5%</option><option value="10">10%</option></select></label><label class="fm-field fm-field-full"><span>หมายเหตุ</span><textarea name="memo" rows="2" placeholder="รายละเอียดเพิ่มเติม"></textarea></label><div class="fm-field-full"><div class="fm-panel-head"><div><h2>รายการสินค้า / บริการ</h2><p>เพิ่มรายการเพื่อคำนวณยอดรวม</p></div><button class="fm-btn fm-btn-light" type="button" id="fmAddLine">＋ เพิ่มรายการ</button></div><div class="fm-table-wrap"><table class="fm-lines-table"><thead><tr><th>รายละเอียด</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th><th></th></tr></thead><tbody id="fmTxnLines"><tr><td><input name="line_desc" required placeholder="ระบุรายการ"></td><td><input name="line_qty" type="number" min="0.001" step="0.001" value="1" required></td><td><input name="line_price" type="number" min="0" step="0.01" value="0" required></td><td class="fm-line-total">฿0.00</td><td><button type="button" class="fm-icon-close" data-remove-line aria-label="ลบรายการ">×</button></td></tr></tbody></table></div></div><div class="fm-summary-box fm-field-full"><div><span>มูลค่าก่อนภาษี</span><b id="fmSubtotal">฿0.00</b></div><div><span>ภาษีมูลค่าเพิ่ม</span><b id="fmVat">฿0.00</b></div><div><span>หัก ณ ที่จ่าย (คำนวณจากมูลค่าก่อน VAT)</span><b id="fmWht">฿0.00</b></div><div class="fm-summary-grand"><span>ยอดสุทธิ</span><b id="fmGrand">฿0.00</b></div></div><div class="fm-form-actions"><button type="reset" class="fm-btn fm-btn-light">ล้างแบบฟอร์ม</button><button type="submit" class="fm-btn fm-btn-primary">ตรวจสอบและแสดงตัวอย่าง</button></div></form><div class="fm-inline-result" id="fmTxnResult" role="status">กรอกข้อมูลเพื่อคำนวณยอดเอกสาร</div></section><footer class="fm-footer">CMS Finance & Accounting • Transaction workflow • Preview build 0.4.0</footer>';
 const $=id=>root.querySelector('#'+id), form=$('fmTxnForm'), lines=$('fmTxnLines');
 const num=v=>Math.max(0,Number(v)||0);
 function calculate(){
  const vatValue=form.elements.vat_rate.value,vatRate=vatValue==='exempt'||vatValue==='none'?0:num(vatValue),whtRate=num(form.elements.wht_rate.value);
  const rows=[...lines.querySelectorAll('tr')],items=rows.map(row=>({description:row.querySelector('[name=line_desc]').value||'รายการ',quantity:num(row.querySelector('[name=line_qty]').value),unit_price:num(row.querySelector('[name=line_price]').value)}));
  const totals=window.FinanceCalculations?window.FinanceCalculations.calculate(items,vatRate,whtRate):{subtotal:0,vat_total:0,wht_total:0,grand_total:0,lines:[]};
  rows.forEach((row,index)=>{row.querySelector('.fm-line-total').textContent=money(totals.lines[index]?.amount||0)});
  $('fmSubtotal').textContent=money(totals.subtotal);$('fmVat').textContent=money(totals.vat_total);$('fmWht').textContent=money(totals.wht_total);$('fmGrand').textContent=money(totals.grand_total);
 }
 $('fmAddLine').onclick=()=>{const tr=document.createElement('tr');tr.innerHTML='<td><input name="line_desc" required placeholder="ระบุรายการ"></td><td><input name="line_qty" type="number" min="0.001" step="0.001" value="1" required></td><td><input name="line_price" type="number" min="0" step="0.01" value="0" required></td><td class="fm-line-total">฿0.00</td><td><button type="button" class="fm-icon-close" data-remove-line aria-label="ลบรายการ">×</button></td>';lines.appendChild(tr);calculate()};
 lines.addEventListener('input',calculate);form.elements.vat_rate.addEventListener('change',calculate);form.elements.wht_rate.addEventListener('change',calculate);
 lines.addEventListener('click',e=>{const b=e.target.closest('[data-remove-line]');if(b&&lines.children.length>1){b.closest('tr').remove();calculate()}});
 form.addEventListener('reset',()=>setTimeout(calculate,0));
 form.onsubmit=async e=>{
  e.preventDefault();const d=Object.fromEntries(new FormData(form));
  const items=[...lines.querySelectorAll('tr')].map(r=>({description:r.querySelector('[name=line_desc]').value,quantity:num(r.querySelector('[name=line_qty]').value),unit_price:num(r.querySelector('[name=line_price]').value)}));
  if(items.some(x=>!x.description.trim()||x.quantity<=0))return;
  $('fmTxnResult').classList.remove('error');
  if(kind==='payments'){$('fmTxnResult').textContent='ตรวจสอบข้อมูลเบื้องต้นผ่าน • '+items.length+' รายการ • ยอดสุทธิ '+$('fmGrand').textContent+' • Workflow การชำระเงินยังไม่เปิดใช้งาน';return}
  if(!window.FinanceAuth){$('fmTxnResult').textContent='Finance API Adapter ไม่พร้อมใช้งาน';$('fmTxnResult').classList.add('error');return}
  const submit=form.querySelector('[type=submit]');submit.disabled=true;$('fmTxnResult').textContent='กำลังบันทึกเอกสาร…';
  try{
   const vatValue=form.elements.vat_rate.value;
   const payload={document_type:kind==='revenue'?'invoice':'expense',document_date:d.document_date,due_date:d.due_date||null,partner_id:d.partner_id||null,notes:d.memo||'',vat_rate:vatValue==='7'?7:0,wht_rate:Number(d.wht_rate||0),lines:items};
   const result=await window.FinanceAuth.request('document.create',{method:'POST',body:payload,idempotencyKey:crypto.randomUUID()});
   $('fmTxnResult').textContent='บันทึกเอกสารสำเร็จ • '+(result.document_number||result.id)+' • ยอดสุทธิ '+money(result.grand_total);
   form.reset();lines.querySelectorAll('tr:not(:first-child)').forEach(row=>row.remove());calculate();
  }catch(err){$('fmTxnResult').textContent=err.message||'บันทึกเอกสารไม่สำเร็จ';$('fmTxnResult').classList.add('error')}
  finally{submit.disabled=false}
 };
 if(kind!=='payments'&&window.FinanceAuth){
  const select=form.elements.partner_id;
  window.FinanceAuth.request('partners').then(result=>{
   select.innerHTML='<option value="">เลือกคู่ค้า</option>';
   (result.items||[]).filter(p=>p.is_active).forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.display_name+(p.tax_id?' · '+p.tax_id:'');select.appendChild(option)});
  }).catch(err=>{select.innerHTML='<option value="">โหลดทะเบียนคู่ค้าไม่ได้</option>';select.disabled=true;$('fmTxnResult').textContent=err.message||'ไม่สามารถโหลดทะเบียนคู่ค้าได้'});
 }
 calculate();
}
window.FinanceTransactions=Object.freeze({render});
})();