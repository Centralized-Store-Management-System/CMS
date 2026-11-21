(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(Number(n)||0);
const field=(label,name,type='text',required=false,placeholder='')=>'<label class="fm-field"><span>'+label+(required?' <i>*</i>':'')+'</span><input name="'+name+'" type="'+type+'" '+(required?'required':'')+' placeholder="'+placeholder+'"></label>';
function render(kind,root){
 const cfg={
 revenue:{eyebrow:'TRANSACTION · ACCOUNTS RECEIVABLE',title:'รายรับ / ลูกหนี้',desc:'บันทึกใบแจ้งหนี้ ใบเสร็จรับเงิน และติดตามยอดค้างชำระ',doc:'invoice',counter:'ลูกค้า'},
 expenses:{eyebrow:'TRANSACTION · ACCOUNTS PAYABLE',title:'รายจ่าย / เจ้าหนี้',desc:'บันทึกค่าใช้จ่าย ใบรับสินค้า และยอดเจ้าหนี้',doc:'expense',counter:'ผู้ขาย'},
 payments:{eyebrow:'CASH MANAGEMENT · PAYMENT VOUCHER',title:'การชำระเงิน',desc:'จัดทำใบสำคัญจ่าย ติดตามการอนุมัติ และกระทบยอดการชำระ',doc:'payment',counter:'ผู้รับเงิน'}
 }[kind];
 root.innerHTML='<div class="fm-page-head"><div><div class="fm-eyebrow">'+cfg.eyebrow+'</div><h1>'+cfg.title+'</h1><p>'+cfg.desc+'</p></div><span class="fm-preview-tag">PREVIEW ONLY</span></div><div class="fm-notice"><span>ⓘ</span><div><b>แบบฟอร์มเตรียมทดสอบ</b><small>ตรวจสอบข้อมูลและคำนวณยอดได้ แต่ยังไม่บันทึกลงฐานข้อมูลหรือส่งอนุมัติ จนกว่า Finance API จะผ่านการทดสอบสิทธิ์และเชื่อมต่อฐานข้อมูล</small></div></div><section class="fm-panel fm-form-panel"><div class="fm-panel-head"><div><h2>รายละเอียดเอกสาร</h2><p>ทุกเอกสารจะมี Transaction ID กลางเมื่อเปิดใช้งานจริง</p></div><span class="fm-status-pill">Draft · Local</span></div><form id="fmTxnForm" class="fm-form-grid">'+field('วันที่เอกสาร','document_date','date',true)+field('วันครบกำหนด','due_date','date')+field('เลขที่อ้างอิง','reference_no','text',false,'เลขที่เอกสารจากต้นทาง')+'<label class="fm-field"><span>ชื่อ'+cfg.counter+' <i>*</i></span><select name="partner_id" required><option value="">กำลังโหลดทะเบียนคู่ค้า…</option></select></label><label class="fm-field"><span>สาขา</span><select name="branch_type"><option value="head_office">สำนักงานใหญ่</option><option value="branch">สาขา</option></select></label><label class="fm-field"><span>ประเภทภาษี</span><select name="vat_rate"><option value="7">VAT 7%</option><option value="0">VAT 0%</option><option value="exempt">ยกเว้น VAT</option><option value="none">ไม่อยู่ในระบบ VAT</option></select></label><label class="fm-field"><span>หัก ณ ที่จ่าย</span><select name="wht_rate"><option value="0">ไม่หัก</option><option value="1">1%</option><option value="2">2%</option><option value="3">3%</option><option value="5">5%</option><option value="10">10%</option></select></label><label class="fm-field fm-field-full"><span>หมายเหตุ</span><textarea name="memo" rows="2" placeholder="รายละเอียดเพิ่มเติม"></textarea></label><div class="fm-field-full"><div class="fm-panel-head"><div><h2>รายการสินค้า / บริการ</h2><p>เพิ่มรายการเพื่อคำนวณยอดรวม</p></div><button class="fm-btn fm-btn-light" type="button" id="fmAddLine">＋ เพิ่มรายการ</button></div><div class="fm-table-wrap"><table class="fm-lines-table"><thead><tr><th>รายละเอียด</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th><th></th></tr></thead><tbody id="fmTxnLines"><tr><td><input name="line_desc" required placeholder="ระบุรายการ"></td><td><input name="line_qty" type="number" min="0.001" step="0.001" value="1" required></td><td><input name="line_price" type="number" min="0" step="0.01" value="0" required></td><td class="fm-line-total">฿0.00</td><td><button type="button" class="fm-icon-close" data-remove-line aria-label="ลบรายการ">×</button></td></tr></tbody></table></div></div><div class="fm-summary-box fm-field-full"><div><span>มูลค่าก่อนภาษี</span><b id="fmSubtotal">฿0.00</b></div><div><span>ภาษีมูลค่าเพิ่ม</span><b id="fmVat">฿0.00</b></div><div><span>หัก ณ ที่จ่าย (คำนวณจากมูลค่าก่อน VAT)</span><b id="fmWht">฿0.00</b></div><div class="fm-summary-grand"><span>ยอดสุทธิ</span><b id="fmGrand">฿0.00</b></div></div><div class="fm-form-actions"><button type="reset" class="fm-btn fm-btn-light">ล้างแบบฟอร์ม</button><button type="submit" class="fm-btn fm-btn-primary">ตรวจสอบและแสดงตัวอย่าง</button></div></form><div class="fm-inline-result" id="fmTxnResult" role="status">กรอกข้อมูลเพื่อคำนวณยอดเอกสาร</div></section><footer class="fm-footer">CMS Finance & Accounting • Transaction workflow • Preview build 0.4.0</footer>';
 const $=id=>root.querySelector('#'+id), form=$('fmTxnForm'), lines=$('fmTxnLines');
 const num=v=>Math.max(0,Number(v)||0);
 function calculate(){
  let subtotal=0,vat=0,wht=0;const vr=form.elements.vat_rate.value,wr=num(form.elements.wht_rate.value),vatRate=vr==='exempt'||vr==='none'?0:num(vr);
  lines.querySelectorAll('tr').forEach(row=>{const q=num(row.querySelector('[name=line_qty]').value),p=num(row.querySelector('[name=line_price]').value),v=Math.round((q*p+Number.EPSILON)*100)/100;subtotal+=v;vat+=Math.round((v*vatRate/100+Number.EPSILON)*100)/100;wht+=Math.round((v*wr/100+Number.EPSILON)*100)/100;row.querySelector('.fm-line-total').textContent=money(v)});
  subtotal=Math.round((subtotal+Number.EPSILON)*100)/100;vat=Math.round((vat+Number.EPSILON)*100)/100;wht=Math.round((wht+Number.EPSILON)*100)/100;
  $('fmSubtotal').textContent=money(subtotal);$('fmVat').textContent=money(vat);$('fmWht').textContent=money(wht);$('fmGrand').textContent=money(subtotal+vat-wht);
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