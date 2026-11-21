// Finance: หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) — สร้างจากคำขอเบิก บันทึกแล้วผูกกับเลขที่คำขอ
// พิมพ์ตามแบบฟอร์มกรมสรรพากร: A4 แนวนอน 2 ฉบับ (ฉบับที่ 1 / ฉบับที่ 2) ขนาด A5 · เส้นทาง #wht50/new:<คำขอ> · #wht50/edit:<id> · #wht50/<id>
(function () {
  const F = window.FIN;
  if (!F) return;
  const { api, esc, money, run } = F;

  const FORMS = [['pnd1a', 'ภ.ง.ด.1ก'], ['pnd1a_special', 'ภ.ง.ด.1ก พิเศษ'], ['pnd2', 'ภ.ง.ด.2'], ['pnd3', 'ภ.ง.ด.3'], ['pnd2a', 'ภ.ง.ด.2ก'], ['pnd3a', 'ภ.ง.ด.3ก'], ['pnd53', 'ภ.ง.ด.53']];
  const PAYER = [['withhold', 'หัก ณ ที่จ่าย'], ['always', 'ออกให้ตลอดไป'], ['once', 'ออกให้ครั้งเดียว'], ['other', 'อื่น ๆ (ระบุ)']];
  // ประเภทเงินได้ตามแบบ (ตัวเลือกในฟอร์ม)
  const CODES = [
    ['5', '5. ค่าบริการ / ค่าจ้างทำของ / ค่าเช่า / ค่าขนส่ง / ค่าโฆษณา (3 เตรส)'],
    ['1', '1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส 40(1)'], ['2', '2. ค่าธรรมเนียม ค่านายหน้า 40(2)'], ['3', '3. ค่าแห่งลิขสิทธิ์ 40(3)'],
    ['4a', '4 (ก) ดอกเบี้ย 40(4)(ก)'],
    ['4b1.1', '4 (ข)(1.1) เงินปันผล — อัตราร้อยละ 30 ของกำไรสุทธิ'], ['4b1.2', '4 (ข)(1.2) เงินปันผล — อัตราร้อยละ 25'], ['4b1.3', '4 (ข)(1.3) เงินปันผล — อัตราร้อยละ 20'], ['4b1.4', '4 (ข)(1.4) เงินปันผล — อัตราอื่น (ระบุ)'],
    ['4b2.1', '4 (ข)(2.1) เงินปันผล — กิจการได้รับยกเว้นภาษี'], ['4b2.2', '4 (ข)(2.2) เงินปันผลที่ได้รับยกเว้น'], ['4b2.3', '4 (ข)(2.3) กำไรหักผลขาดทุนยกมาไม่เกิน 5 ปี'], ['4b2.4', '4 (ข)(2.4) equity method'], ['4b2.5', '4 (ข)(2.5) อื่น ๆ (ระบุ)'],
    ['6', '6. อื่น ๆ (ระบุ)'],
  ];
  const RATES = [1, 1.5, 2, 3, 5, 10, 15];
  const needLabel = c => ['6', '4b1.4', '4b2.5'].includes(c);
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---------- จำนวนเงินเป็นตัวอักษร ----------
  function bahtText(n) {
    n = r2(Math.abs(Number(n) || 0));
    const D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], U = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
    const part = (s, multi) => {   // อ่านเลขไม่เกิน 6 หลัก · multi = มีหลักที่สูงกว่า (หน่วย 1 อ่านว่า "เอ็ด")
      let out = '';
      for (let i = 0; i < s.length; i++) {
        const k = +s[i], p = s.length - i - 1;
        if (!k) continue;
        if (p === 1 && k === 1) out += 'สิบ';
        else if (p === 1 && k === 2) out += 'ยี่สิบ';
        else if (p === 0 && k === 1 && (multi || out)) out += 'เอ็ด';
        else out += D[k] + U[p];
      }
      return out;
    };
    const read = s => {
      s = s.replace(/^0+/, '') || '0';
      if (s.length <= 6) return part(s, false);
      const lo = s.slice(-6).replace(/^0+/, '');
      return read(s.slice(0, -6)) + 'ล้าน' + (lo ? part(lo, true) : '');
    };
    const [i, f] = n.toFixed(2).split('.');
    const baht = Number(i) ? read(i) + 'บาท' : '';
    const sat = Number(f) ? part(String(Number(f)), false) + 'สตางค์' : 'ถ้วน';
    return baht ? baht + sat : (Number(f) ? sat : 'ศูนย์บาทถ้วน');
  }
  F.bahtText = bahtText;

  // ---------- แบบฟอร์มพิมพ์ (ตามแบบ 50 ทวิ) ----------
  const thd = v => { const s = String(v || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${+y + 543}`; };
  const digits = tax => {
    const s = String(tax || '').replace(/\D/g, '').padEnd(13, ' ').slice(0, 13).split('');
    const g = [1, 4, 5, 2, 1]; let i = 0;
    return `<span class="d13">${g.map(n => { const b = s.slice(i, i + n).map(c => `<i>${c.trim() ? esc(c) : '&nbsp;'}</i>`).join(''); i += n; return `<span>${b}</span>`; }).join('<em>-</em>')}</span>`;
  };
  const box = on => `<b class="cb">${on ? '✓' : ''}</b>`;
  const amt = v => { const [i, f] = r2(v).toFixed(2).split('.'); return `<span class="m">${money(Number(i)).replace(/\.00$/, '').replace(/\.\d+$/, '')}</span><span class="s">${f}</span>`; };

  function sheet(c, copyNo) {
    const items = c.items || [];
    const by = {};
    items.forEach(x => { const k = x.code; const o = by[k] || (by[k] = { amount: 0, tax: 0, date: '', label: [] }); o.amount = r2(o.amount + Number(x.amount)); o.tax = r2(o.tax + Number(x.tax)); if (!o.date || x.pay_date > o.date) o.date = x.pay_date; if (x.label) o.label.push(x.label); });
    const cell = k => { const o = by[k]; return o ? `<td class="c">${thd(o.date)}</td><td class="n">${amt(o.amount)}</td><td class="n">${amt(o.tax)}</td>` : '<td></td><td class="n"></td><td class="n"></td>'; };
    const lab = (k, dots) => by[k] && by[k].label.length ? `<u>${esc(by[k].label.join(', '))}</u>` : dots;
    const row = (k, html, ind) => `<tr><td class="t${ind ? ' i' + ind : ''}">${html}</td>${cell(k)}</tr>`;
    const txt = (html, ind) => `<tr><td class="t${ind ? ' i' + ind : ''}">${html}</td><td></td><td class="n"></td><td class="n"></td></tr>`;
    const p = c.payer || {}, e = c.payee || {}, fu = c.funds || {};
    return `<section class="w">
      <div class="cp"><div>${box(copyNo === 1)} ฉบับที่ 1 <small>(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)</small><br>${box(copyNo === 2)} ฉบับที่ 2 <small>(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</small></div><span class="ref">REF#${esc(c.document_number || '')}</span></div>
      <div class="fr">
        <div class="hd"><div class="ttl"><b>หนังสือรับรองการหักภาษี ณ ที่จ่าย</b><small>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</small></div><div class="no"><div>เล่มที่ <u>${esc(c.book_no || '')}</u></div><div>เลขที่ <u>${esc(c.cert_number || '(ยังไม่บันทึก)')}</u></div></div></div>
        <div class="bx"><div class="ln"><b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :</b><span class="tx">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* ${digits(p.tax_id)}</span></div>
          <div class="ln"><span>ชื่อ</span><u class="f">${esc(p.name || '')}${p.branch ? ' (' + esc(p.branch) + ')' : ''}</u><span class="tx">เลขประจำตัวผู้เสียภาษีอากร ${digits('')}</span></div>
          <div class="hint">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</div>
          <div class="ln"><span>ที่อยู่</span><u class="f">${esc(p.address || '')}</u></div><div class="hint">(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div></div>
        <div class="bx"><div class="ln"><b>ผู้ถูกหักภาษี ณ ที่จ่าย :</b><span class="tx">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* ${digits(e.tax_id)}</span></div>
          <div class="ln"><span>ชื่อ</span><u class="f">${esc(e.name || '')}${e.branch ? ' (' + esc(e.branch) + ')' : ''}</u><span class="tx">เลขประจำตัวผู้เสียภาษีอากร ${digits('')}</span></div>
          <div class="hint">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</div>
          <div class="ln"><span>ที่อยู่</span><u class="f">${esc(e.address || '')}</u></div><div class="hint">(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div></div>
        <div class="bx fm7"><div class="sq"><b>ลำดับที่</b> <u class="seq">${esc(c.seq_no || '')}</u> ในแบบ<div class="hint">(ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่างลำดับที่ตาม หนังสือรับรองฯ กับแบบยื่นรายการภาษีหักที่จ่าย)</div></div>
          <div class="ops">${FORMS.map(([k, t], i) => `<span>${box(c.form_type === k)} (${i + 1}) ${t}</span>`).join('')}</div></div>
        <table class="in"><colgroup><col><col style="width:15%"><col style="width:17%"><col style="width:15%"></colgroup>
          <thead><tr><th>ประเภทเงินได้พึงประเมินที่จ่าย</th><th>วัน เดือน<br>หรือปีภาษี ที่จ่าย</th><th>จำนวนเงินที่จ่าย</th><th>ภาษีที่หัก<br>และนำส่งไว้</th></tr></thead>
          <tbody>
            ${row('1', '1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)')}
            ${row('2', '2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)')}
            ${row('3', '3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)')}
            ${row('4a', '4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)')}
            ${txt('(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)', 1)}
            ${txt('(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจาก กำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้', 2)}
            ${row('4b1.1', '(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ', 3)}${row('4b1.2', '(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ', 3)}${row('4b1.3', '(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ', 3)}
            ${row('4b1.4', '(1.4) อัตราอื่น ๆ (ระบุ) ' + lab('4b1.4', '.................') + ' ของกำไรสุทธิ', 3)}
            ${txt('(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก', 2)}
            ${row('4b2.1', '(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล', 3)}
            ${row('4b2.2', '(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวม คำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล', 3)}
            ${row('4b2.3', '(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี ก่อนรอบระยะเวลาบัญชีปีปัจจุบัน', 3)}
            ${row('4b2.4', '(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)', 3)}
            ${row('4b2.5', '(2.5) อื่น ๆ (ระบุ) ' + lab('4b2.5', '.................'), 3)}
            ${row('5', '5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใด ๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ' + (by['5'] && by['5'].label.length ? ` <u>(${esc(by['5'].label.join(', '))})</u>` : ''))}
            ${row('6', '6. อื่น ๆ (ระบุ) ' + lab('6', '..............................'))}
          </tbody>
          <tfoot><tr><td class="r" colspan="2">รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td><td class="n">${amt(c.total_amount)}</td><td class="n">${amt(c.total_tax)}</td></tr></tfoot></table>
        <div class="bx wd"><b>รวมเงินภาษีที่หักนำส่ง</b> (ตัวอักษร) <span class="wbox">${esc(bahtText(c.total_tax))}</span></div>
        <div class="bx fd">เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <u>${money(fu.gpf || 0)}</u> บาท กองทุนประกันสังคม <u>${money(fu.sso || 0)}</u> บาท กองทุนสำรองเลี้ยงชีพ <u>${money(fu.pvd || 0)}</u> บาท</div>
        <div class="bx py"><b>ผู้จ่ายเงิน</b>${PAYER.map(([k, t], i) => `<span>${box(c.payer_condition === k)} (${i + 1}) ${t}${k === 'other' && c.payer_condition === 'other' ? ' <u>' + esc(c.payer_condition_other || '') + '</u>' : ''}</span>`).join('')}</div>
        <div class="ft"><div class="wn"><b>คำเตือน</b> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div>
          <div class="sg"><div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
            <div class="sl">ลงชื่อ <span class="dl"></span> ผู้จ่ายเงิน</div>
            <div class="dt">${(() => { const t = thd(c.issue_date).split('/'); return `<u>${t[0] || ''}</u> / <u>${t[1] || ''}</u> / <u>${t[2] || ''}</u>`; })()}</div>
            <small>(วัน เดือน ปี ที่ออกหนังสือรับรองฯ)</small><span class="stamp">ประทับตรา<br>นิติบุคคล<br>(ถ้ามี)</span></div></div>
      </div>
      <div class="nt"><b>หมายเหตุ</b> เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* หมายถึง 1. กรณีบุคคลธรรมดาไทย ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง 2. กรณีนิติบุคคล ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า 3. กรณีอื่น ๆ นอกเหนือจาก 1. และ 2. ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร</div>
    </section>`;
  }
  const PRINT_CSS = `@page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}html,body{margin:0}body{font-family:"Sarabun","TH Sarabun New","Tahoma",sans-serif;color:#000;font-size:7.4pt;line-height:1.28;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;padding:10px;background:#f3f4f6;border-bottom:1px solid #ddd;font:14px sans-serif}.bar button{font:inherit;padding:8px 18px;border-radius:8px;border:1px solid #bbb;background:#fff;cursor:pointer}.bar button.p{background:#0f766e;color:#fff;border-color:#0f766e}
    .pg{display:flex;gap:7mm;justify-content:center;padding:4mm 0;page-break-after:always}.pg:last-child{page-break-after:auto}
    .w{width:138mm;flex:none}.cp{display:flex;justify-content:space-between;align-items:flex-start;font-size:6.6pt;margin-bottom:1mm}.cp small{font-size:5.6pt}.ref{font-size:6pt}
    .fr{border:1.2px solid #000;padding:1.2mm}.hd{display:flex;align-items:center;justify-content:center;position:relative;padding:1mm 0 1.5mm}.ttl{text-align:center}.ttl b{display:block;font-size:10.5pt}.ttl small{font-size:7pt}
    .no{position:absolute;right:1mm;top:1mm;font-size:6.6pt;line-height:1.5}.no u{display:inline-block;min-width:24mm;border-bottom:1px dotted #000;text-decoration:none}
    .bx{border:1px solid #000;border-radius:1.5mm;padding:.8mm 1.4mm;margin-top:1mm}.ln{display:flex;align-items:baseline;gap:1.5mm;margin:.4mm 0}.ln .f{flex:1;border-bottom:1px dotted #000;text-decoration:none;min-height:3.4mm;padding-left:1mm}
    .tx{margin-left:auto;font-size:6.2pt;white-space:nowrap}.hint{font-size:5.2pt;color:#222;margin:-.3mm 0 .2mm 9mm}
    .d13{display:inline-flex;align-items:center;vertical-align:middle}.d13 span{display:inline-flex}.d13 i{display:inline-block;width:3.1mm;height:3.6mm;border:.8px solid #000;margin-left:-.8px;font-style:normal;text-align:center;font-size:6.6pt;line-height:3.5mm}.d13 em{font-style:normal;margin:0 .4mm}
    .fm7{display:grid;grid-template-columns:38mm 1fr;gap:1.5mm;align-items:start}.sq u.seq{display:inline-block;min-width:14mm;border:1px solid #000;height:3.8mm;text-decoration:none;vertical-align:middle;text-align:center}.sq .hint{margin:0}
    .ops{display:grid;grid-template-columns:repeat(4,auto);gap:.6mm 2.5mm;font-size:6.6pt}
    .cb{display:inline-block;width:2.8mm;height:2.8mm;border:.8px solid #000;text-align:center;font-size:6.4pt;line-height:2.6mm;vertical-align:-.4mm;margin-right:.4mm}
    table.in{width:100%;border-collapse:collapse;margin-top:1mm;border:1px solid #000;table-layout:fixed}table.in th{border:1px solid #000;font-size:6.6pt;padding:.6mm;font-weight:700;text-align:center;line-height:1.15}
    table.in td{border-left:1px solid #000;border-right:1px solid #000;padding:.1mm 1mm;vertical-align:bottom;font-size:6.5pt;line-height:1.22}table.in td.t{padding-left:1mm}table.in td.i1{padding-left:3.5mm}table.in td.i2{padding-left:5.5mm}table.in td.i3{padding-left:8mm}
    table.in td.c{text-align:center;white-space:nowrap}table.in td.n{white-space:nowrap;padding:0}table.in td.n .m{display:inline-block;width:72%;text-align:right;padding-right:.8mm}table.in td.n .s{display:inline-block;width:28%;text-align:center}
    table.in td.n{background:linear-gradient(to right,transparent 72%,#000 72%,#000 calc(72% + 1px),transparent calc(72% + 1px))}table.in tbody tr:last-child td{padding-bottom:1mm}
    table.in tfoot td{border:1px solid #000;font-weight:700;padding:.8mm 1mm}table.in tfoot td.r{text-align:right}table.in u{text-decoration:none;border-bottom:1px dotted #000}
    .wd{display:flex;align-items:center;gap:1.5mm}.wbox{flex:1;background:#e9e9e9;padding:.7mm 2mm;font-weight:700}.fd{font-size:6.3pt}.fd u{text-decoration:none;border-bottom:1px dotted #000;padding:0 1mm}
    .py{display:flex;flex-wrap:wrap;gap:1mm 3mm;align-items:center}.py u{text-decoration:none;border-bottom:1px dotted #000}
    .ft{display:grid;grid-template-columns:42% 58%;gap:1mm;margin-top:1mm}.wn{border:1px solid #000;border-radius:1.5mm;padding:1mm 1.4mm;font-size:6.1pt}
    .sg{border:1px solid #000;border-radius:1.5mm;padding:1mm 1.4mm;position:relative;text-align:center;font-size:6.3pt;min-height:19mm}.sl{margin-top:4mm}.dl{display:inline-block;width:34mm;border-bottom:1px dotted #000}.dt u{display:inline-block;min-width:7mm;border-bottom:1px dotted #000;text-decoration:none}
    .stamp{position:absolute;right:1.5mm;bottom:1.5mm;width:12mm;height:12mm;border:1px solid #000;border-radius:50%;font-size:4.6pt;line-height:1.15;display:flex;align-items:center;justify-content:center;text-align:center}
    .nt{font-size:5.4pt;margin-top:1mm;line-height:1.3}
    @media print{.bar{display:none}.pg{padding:0}}`;

  /** เปิดหน้าต่างพิมพ์ (เรียกจากการกดปุ่มโดยตรง เพื่อไม่ให้เบราว์เซอร์บล็อก) · certs = 1 ฉบับ หรือหลายฉบับ */
  function printWindow() {
    const win = window.open('', '_blank');
    if (!win) { F.toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — กรุณาอนุญาต Pop-up', 'bad'); return null; }
    win.document.write('<p style="font:15px sans-serif;padding:24px">กำลังจัดเตรียมหนังสือรับรอง…</p>');
    return win;
  }
  function renderPrint(win, certs, title) {
    if (!win) return;
    const pages = certs.map(c => `<div class="pg">${sheet(c, 1)}${sheet(c, 2)}</div>`).join('');
    win.document.open();
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
      <style>${PRINT_CSS}</style></head><body><div class="bar"><button class="p" onclick="window.print()">พิมพ์ / บันทึก PDF</button><button onclick="window.close()">ปิด</button></div>${pages}
      <script>(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(()=>window.print(),250))<\/script></body></html>`);
    win.document.close();
  }
  F.printWht = async (id, win) => {
    win = win || printWindow(); if (!win) return;
    try { const r = await api.get('wht-certificate', { id }); renderPrint(win, [r.certificate], 'หนังสือรับรองหัก ณ ที่จ่าย ' + r.certificate.cert_number); }
    catch (e) { win.document.body.innerHTML = '<p style="font:15px sans-serif;padding:24px;color:#b00">' + esc(e.message) + '</p>'; }
  };

  // ---------- ฟอร์มกรอก ----------
  const partyFields = (key, v, title, hint) => `<section class="fm-panel"><div class="fm-panel-head"><div><h2>${title}</h2>${hint ? `<p>${hint}</p>` : ''}</div>${key === 'payee' ? '<button type="button" class="fm-btn fm-btn-sm fm-btn-light" id="wtPick">เลือกจากคู่ค้า</button>' : ''}</div>
    <div class="fm-form-grid">
      <label class="fm-field fm-field-full"><span>ชื่อ *</span><input name="${key}.name" required maxlength="200" value="${esc(v.name || '')}"></label>
      <label class="fm-field"><span>เลขประจำตัวผู้เสียภาษี (13 หลัก)${key === 'payer' ? ' *' : ''}</span><input name="${key}.tax_id" inputmode="numeric" maxlength="17" pattern="[0-9 -]{13,17}" ${key === 'payer' ? 'required' : ''} value="${esc(v.tax_id || '')}"></label>
      <label class="fm-field"><span>สำนักงาน / สาขา</span><input name="${key}.branch" maxlength="60" placeholder="สำนักงานใหญ่" value="${esc(v.branch || '')}"></label>
      <label class="fm-field fm-field-full"><span>ที่อยู่</span><textarea name="${key}.address" rows="2" maxlength="400">${esc(v.address || '')}</textarea></label>
    </div></section>`;
  const itemRow = (x, i) => `<div class="wt-item" data-i="${i}">
      <label class="fm-field wt-code"><span>ประเภทเงินได้</span><select name="code">${CODES.map(([k, t]) => `<option value="${k}" ${k === x.code ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="fm-field wt-lab"><span>รายละเอียด / ระบุ</span><input name="label" maxlength="200" value="${esc(x.label || '')}" placeholder="เช่น ค่าบริการติดตั้ง"></label>
      <label class="fm-field"><span>วันที่จ่าย *</span><input name="pay_date" type="date" required value="${esc(x.pay_date || F.today())}"></label>
      <label class="fm-field"><span>จำนวนเงินที่จ่าย (ก่อน VAT) *</span><input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(x.amount ?? '')}"></label>
      <label class="fm-field"><span>อัตรา %</span><select name="rate">${[...new Set([...RATES, Number(x.rate) || 3])].sort((a, b) => a - b).map(v => `<option value="${v}" ${Number(x.rate || 3) === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>
      <label class="fm-field"><span>ภาษีที่หัก *</span><input name="tax" type="number" inputmode="decimal" step="0.01" min="0" required value="${esc(x.tax ?? '')}"></label>
      <button type="button" class="fm-btn fm-btn-sm fm-btn-ghost wt-del" aria-label="ลบรายการ" ${i ? '' : 'hidden'}>ลบ</button>
    </div>`;

  async function form(el, docId, certId) {
    let base, cert = null, doc;
    if (certId) { cert = (await api.get('wht-certificate', { id: certId })).certificate; docId = cert.document_id; }
    const dr = await api.get('wht-certificate-draft', { document_id: docId });
    doc = dr.document; base = cert || dr.draft;
    const back = '#expflow/' + docId;
    el.innerHTML = F.head('WHT CERTIFICATE · 50 ทวิ', (cert ? 'แก้ไข ' + cert.cert_number : 'สร้างหนังสือรับรองหัก ณ ที่จ่าย'), `ผูกกับคำขอเบิก ${esc(doc.document_number)} — บันทึกแล้วแนบกับคำขอให้อัตโนมัติ พิมพ์ให้ผู้รับเงินได้ทันที`,
      `<button class="fm-btn fm-btn-light" data-go="${back}">← กลับคำขอ</button>`) +
      `<form id="wtForm" autocomplete="off" novalidate>
        <section class="fm-panel"><div class="fm-form-grid three">
          <label class="fm-field"><span>เลขที่</span><input value="${esc(cert ? cert.cert_number : 'ออกให้อัตโนมัติเมื่อบันทึก')}" readonly tabindex="-1"></label>
          <label class="fm-field"><span>เล่มที่</span><input name="book_no" maxlength="30" value="${esc(base.book_no || '')}"></label>
          <label class="fm-field"><span>วันที่ออกหนังสือ *</span><input name="issue_date" type="date" required value="${esc(F.d10(base.issue_date) || F.today())}"></label>
        </div></section>
        <div class="fm-grid2">${partyFields('payer', base.payer || {}, 'ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)', 'ข้อมูลบริษัท — แก้ได้ที่ ตั้งค่า › ข้อมูลบริษัท')}${partyFields('payee', base.payee || {}, 'ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)', '')}</div>
        <section class="fm-panel"><div class="fm-panel-head"><h2>ยื่นในแบบ</h2></div>
          <div class="wt-chips">${FORMS.map(([k, t], i) => `<label class="wt-chip"><input type="radio" name="form_type" value="${k}" ${base.form_type === k ? 'checked' : ''}> (${i + 1}) ${t}</label>`).join('')}</div>
          <div class="fm-form-grid three" style="margin-top:10px"><label class="fm-field"><span>ลำดับที่ในแบบ</span><input name="seq_no" maxlength="30" value="${esc(base.seq_no || '')}"></label></div>
          <small class="fm-muted">ภ.ง.ด.3 = ผู้รับเงินเป็นบุคคลธรรมดา · ภ.ง.ด.53 = นิติบุคคล (บริษัท / ห้างหุ้นส่วน)</small></section>
        <section class="fm-panel"><div class="fm-panel-head"><div><h2>รายการเงินได้ที่จ่าย</h2><p>ใส่ยอดก่อน VAT · ภาษีคำนวณจากอัตราให้อัตโนมัติ (แก้ได้)</p></div><button type="button" class="fm-btn fm-btn-sm fm-btn-light" id="wtAdd">＋ เพิ่มรายการ</button></div>
          <div id="wtItems">${(base.items || []).map(itemRow).join('')}</div>
          <div class="wt-total"><div><small>รวมเงินที่จ่าย</small><b id="wtSumA">0.00</b></div><div><small>รวมภาษีที่หักนำส่ง</small><b id="wtSumT">0.00</b></div><div class="wt-words" id="wtWords"></div></div>
          ${doc.wht_total ? `<small class="fm-muted">ยอดหัก ณ ที่จ่ายในคำขอ ${money(doc.wht_total)} บาท</small>` : ''}</section>
        <section class="fm-panel"><div class="fm-panel-head"><h2>ผู้จ่ายเงิน</h2></div>
          <div class="wt-chips">${PAYER.map(([k, t], i) => `<label class="wt-chip"><input type="radio" name="payer_condition" value="${k}" ${(base.payer_condition || 'withhold') === k ? 'checked' : ''}> (${i + 1}) ${t}</label>`).join('')}</div>
          <label class="fm-field" id="wtOther" ${base.payer_condition === 'other' ? '' : 'hidden'} style="margin-top:10px;max-width:420px"><span>ระบุ</span><input name="payer_condition_other" maxlength="120" value="${esc(base.payer_condition_other || '')}"></label>
          <details class="wt-more"><summary>เงินที่จ่ายเข้ากองทุน (กบข. / ประกันสังคม / กองทุนสำรองเลี้ยงชีพ)</summary><div class="fm-form-grid three">
            <label class="fm-field"><span>กบข./กสจ./กองทุนสงเคราะห์ครูฯ</span><input name="funds.gpf" type="number" step="0.01" min="0" value="${esc((base.funds || {}).gpf || 0)}"></label>
            <label class="fm-field"><span>กองทุนประกันสังคม</span><input name="funds.sso" type="number" step="0.01" min="0" value="${esc((base.funds || {}).sso || 0)}"></label>
            <label class="fm-field"><span>กองทุนสำรองเลี้ยงชีพ</span><input name="funds.pvd" type="number" step="0.01" min="0" value="${esc((base.funds || {}).pvd || 0)}"></label></div></details>
          <label class="fm-field fm-field-full" style="margin-top:10px"><span>หมายเหตุ (ภายใน ไม่พิมพ์)</span><input name="note" maxlength="500" value="${esc(base.note || '')}"></label></section>
        <div class="fm-form-actions wt-actions"><button type="button" class="fm-btn fm-btn-light" data-wt="preview">ดูตัวอย่าง</button><button type="button" class="fm-btn fm-btn-light" data-wt="save">บันทึก</button><button type="button" class="fm-btn fm-btn-primary" data-wt="print">บันทึก + พิมพ์</button></div>
      </form>`;
    const f = F.$('#wtForm', el), list = F.$('#wtItems', el);
    const items = () => [...list.querySelectorAll('.wt-item')].map(r => ({ code: r.querySelector('[name=code]').value, label: r.querySelector('[name=label]').value.trim(),
      pay_date: r.querySelector('[name=pay_date]').value, amount: Number(r.querySelector('[name=amount]').value || 0), rate: Number(r.querySelector('[name=rate]').value || 0), tax: Number(r.querySelector('[name=tax]').value || 0) }));
    const sums = () => {
      const it = items(), a = r2(it.reduce((s, x) => s + x.amount, 0)), t = r2(it.reduce((s, x) => s + x.tax, 0));
      F.$('#wtSumA', el).textContent = money(a); F.$('#wtSumT', el).textContent = money(t); F.$('#wtWords', el).textContent = '(' + bahtText(t) + ')';
      list.querySelectorAll('.wt-item').forEach(r => { const need = needLabel(r.querySelector('[name=code]').value); r.querySelector('[name=label]').required = need; r.querySelector('.wt-lab span').textContent = need ? 'ระบุ *' : 'รายละเอียด / ระบุ'; });
      list.querySelectorAll('.wt-del').forEach((b, i) => { b.hidden = list.children.length < 2; void i; });
    };
    const val = name => { const x = f.elements[name]; return x ? x.value.trim() : ''; };
    const body = () => ({
      id: cert ? cert.id : undefined, document_id: docId, book_no: val('book_no'), issue_date: val('issue_date'), seq_no: val('seq_no'), note: val('note'),
      form_type: (f.querySelector('[name=form_type]:checked') || {}).value, payer_condition: (f.querySelector('[name=payer_condition]:checked') || {}).value || 'withhold', payer_condition_other: val('payer_condition_other'),
      payer: { name: val('payer.name'), tax_id: val('payer.tax_id').replace(/\D/g, ''), branch: val('payer.branch'), address: val('payer.address') },
      payee: { name: val('payee.name'), tax_id: val('payee.tax_id').replace(/\D/g, ''), branch: val('payee.branch'), address: val('payee.address') },
      items: items(), funds: { gpf: Number(val('funds.gpf') || 0), sso: Number(val('funds.sso') || 0), pvd: Number(val('funds.pvd') || 0) },
    });
    const check = () => {
      if (!f.reportValidity()) return false;
      const b = body();
      if (!b.form_type) { F.toast('กรุณาเลือกแบบที่ยื่น (ภ.ง.ด.)', 'bad'); return false; }
      if (b.items.some(x => x.tax > x.amount)) { F.toast('ภาษีที่หักต้องไม่มากกว่าจำนวนเงินที่จ่าย', 'bad'); return false; }
      return true;
    };
    f.addEventListener('input', e => {
      const r = e.target.closest('.wt-item');
      if (r && ['amount', 'rate'].includes(e.target.name)) r.querySelector('[name=tax]').value = (r2(Number(r.querySelector('[name=amount]').value || 0) * Number(r.querySelector('[name=rate]').value || 0) / 100)).toFixed(2);
      if (e.target.name === 'payer_condition') F.$('#wtOther', el).hidden = e.target.value !== 'other';
      sums();
    });
    f.addEventListener('change', e => { if (e.target.name === 'payer_condition') F.$('#wtOther', el).hidden = e.target.value !== 'other'; if (e.target.name === 'rate') f.dispatchEvent(new Event('input')); });
    list.addEventListener('change', e => { if (e.target.name === 'rate') { const r = e.target.closest('.wt-item'); r.querySelector('[name=tax]').value = (r2(Number(r.querySelector('[name=amount]').value || 0) * Number(e.target.value) / 100)).toFixed(2); sums(); } });
    F.$('#wtAdd', el).onclick = () => { const last = items().pop() || {}; list.insertAdjacentHTML('beforeend', itemRow({ code: last.code || '5', pay_date: last.pay_date, rate: last.rate || 3 }, list.children.length)); sums(); };
    list.addEventListener('click', e => { const b = e.target.closest('.wt-del'); if (b && list.children.length > 1) { b.closest('.wt-item').remove(); sums(); } });
    F.$('#wtPick', el).onclick = async () => {
      const ps = await F.partners().catch(() => []);
      const m = F.modal('เลือกผู้รับเงินจากคู่ค้า', ps.length ? `<div class="wt-pick">${ps.map(p => `<button type="button" class="fm-btn fm-btn-light" data-p="${esc(p.id)}"><b>${esc(p.display_name)}</b><small>${esc(p.tax_id || 'ไม่มีเลขผู้เสียภาษี')}</small></button>`).join('')}</div>` : '<p class="fm-muted">ยังไม่มีคู่ค้าในระบบ</p>');
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        const p = ps.find(x => x.id === b.dataset.p) || {};
        const adr = p.address && typeof p.address === 'object' ? p.address.text : p.address;
        f.elements['payee.name'].value = p.legal_name || p.display_name || ''; f.elements['payee.tax_id'].value = p.tax_id || '';
        f.elements['payee.branch'].value = p.branch_number ? 'สาขา ' + p.branch_number : ''; f.elements['payee.address'].value = adr || '';
        const ft = String(p.default_wht_type || '').toLowerCase(); const radio = f.querySelector(`[name=form_type][value="${ft === 'pnd53' ? 'pnd53' : ft === 'pnd3' ? 'pnd3' : (/^0\d{12}$/.test(p.tax_id || '') ? 'pnd53' : 'pnd3')}"]`); if (radio) radio.checked = true;
        m.close();
      });
    };
    f.addEventListener('click', async e => {
      const b = e.target.closest('[data-wt]'); if (!b) return;
      if (!check()) return;
      if (b.dataset.wt === 'preview') { const w = printWindow(); renderPrint(w, [{ ...body(), cert_number: cert && cert.cert_number, document_number: doc.document_number, total_amount: r2(body().items.reduce((s, x) => s + x.amount, 0)), total_tax: r2(body().items.reduce((s, x) => s + x.tax, 0)) }], 'ตัวอย่างหนังสือรับรองหัก ณ ที่จ่าย'); return; }
      const win = b.dataset.wt === 'print' ? printWindow() : null;
      const out = await run(b, () => api.post('wht-certificate.save', body()), x => (cert ? 'บันทึกการแก้ไขแล้ว · ' : 'สร้างแล้ว · ') + x.cert_number + ' แนบกับคำขอ ' + x.document_number);
      if (!out) { if (win) win.close(); return; }
      if (win) F.printWht(out.id, win);
      F.nav(back);
    });
    sums();
  }

  // ---------- ดูหนังสือ ----------
  async function view(el, id) {
    const c = (await api.get('wht-certificate', { id })).certificate;
    const active = c.status === 'active';
    el.innerHTML = F.head('WHT CERTIFICATE · 50 ทวิ', c.cert_number, `คำขอเบิก ${esc(c.document_number)}${active ? '' : ' · <span class="fm-badge bad">ยกเลิกแล้ว</span>' + (c.void_reason ? ' ' + esc(c.void_reason) : '')}`,
      `<button class="fm-btn fm-btn-light" data-go="#expflow/${esc(c.document_id)}">← กลับคำขอ</button>${active ? '<button class="fm-btn fm-btn-primary" data-v="print">พิมพ์</button>' : ''}`) +
      `<div class="fm-panel wt-preview"><iframe title="ตัวอย่างหนังสือรับรอง" class="wt-frame"></iframe></div>`;
    const fr = el.querySelector('.wt-frame');
    fr.srcdoc = `<!doctype html><html lang="th"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet"><style>${PRINT_CSS}body{background:#fff}.pg{padding:3mm}</style></head><body><div class="pg">${sheet(c, 1)}</div></body></html>`;
    fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + 8 + 'px'; } catch (_) { /* */ } };
    el.addEventListener('click', e => { const b = e.target.closest('[data-v="print"]'); if (b) F.printWht(c.id); });
  }

  F.page('wht50', {
    title: 'หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)', nav: 'expflow',
    async render(el, arg) {
      if (arg.startsWith('new:')) return form(el, arg.slice(4), null);
      if (arg.startsWith('edit:')) return form(el, null, arg.slice(5));
      if (arg) return view(el, arg);
      el.innerHTML = F.errorBox('เปิดจากหน้าคำขอเบิก (เบิก–เคลียร์ค่าใช้จ่าย)');
    },
  });
})();
