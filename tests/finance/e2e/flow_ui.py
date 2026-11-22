# ทดสอบหน้าจอ "เบิก–เคลียร์ค่าใช้จ่าย" ในหน้าหลังร้านจริง (index.html) ตามแผนภาพ: Staff → Owner → Staff → Owner → ผู้ตรวจสุดท้าย → ปิดงาน
# ต้องรีเซ็ต DB (up.sh) + เว็บ python3 -m http.server 8767 ที่โฟลเดอร์ repo
import json, urllib.request
from playwright.sync_api import sync_playwright
exec(open('/tmp/fe2e/embed.py').read().split('with sync_playwright() as p:')[0])   # open_ctx, wait_fin, ok, R, ERR
API = 'http://localhost:8000/'
_fin0, _bo0 = fin_route, bo_route
def fin_route(r):   # ปิด context ระหว่างคำขอค้าง → ไม่ต้องล้มทั้งชุด
    try: _fin0(r)
    except Exception:
        try: r.abort()
        except Exception: pass
def bo_route(r):
    try: _bo0(r)
    except Exception:
        try: r.abort()
        except Exception: pass
def post(tok, action, **body):
    req = urllib.request.Request(API, data=json.dumps({'action': action, **body}).encode(), method='POST', headers={'content-type': 'application/json', 'x-cms-session': tok})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
OWN, STF, VER, MGR = 'tok_owner_123', 'tok_staff_1234', 'tok_verifier_12', 'tok_mgr_12345'
post(OWN, 'setup.defaults')
post(OWN, 'company.update', legal_name='Café Amazon Test', tax_id='0105566000001', vat_registered=True)
for ref, role, name in [('u:U5', 'manager', 'Manager M'), ('u:U6', 'staff', 'Staff S'), ('u:U7', 'verifier', 'Verifier V')]:
    post(OWN, 'user.set', actor_ref=ref, role=role, display_name=name)
PDF = {'name': 'ใบเสนอราคา.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 quote'}
SLIP = {'name': 'slip.jpg', 'mimeType': 'image/jpeg', 'buffer': b'\xff\xd8\xff slip'}

def wait_page(pg, text):
  try:
    pg.wait_for_function(f"(document.querySelector('#fmContent .fm-page-head h1')||{{}}).textContent?.includes({json.dumps(text)}) && !document.querySelector('#fmContent .fm-loading')", timeout=45000)
  except Exception:
    pg.screenshot(path='/tmp/fe2e/flow-fail.png'); print('FAIL at', text, pg.evaluate('location.hash'), (pg.evaluate("(document.querySelector('#view')||{}).innerText") or '')[:300]); raise
def answer(pg, text=None):
    pg.wait_for_selector('#finLayer .fm-overlay #fmAskOk', timeout=5000)
    if text is not None: pg.fill('#finLayer #fmAskIn', text)
    pg.click('#finLayer #fmAskOk')
def stage_now(pg): return pg.evaluate("(document.querySelector('.ff-step[aria-current=step] b')||{}).textContent||''")
def after_action(pg, cond_js):
    pg.wait_for_function(cond_js, timeout=20000)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- 1) Staff ขอเบิก + แนบใบเสนอราคา ----------
    c, pg = open_ctx(p, b, STF, path='index.html#fin')
    wait_page(pg, 'เบิก–เคลียร์')
    ok('Staff เปิด Finance → เริ่มที่หน้าเบิก–เคลียร์', pg.evaluate('location.hash') == '#fin/expflow')
    pg.wait_for_selector('#nav a[href="#fin"]', timeout=20000)
    ok('เมนูย่อยมี "เบิก–เคลียร์ค่าใช้จ่าย" (ไม่มีหน้าตรวจเอกสารหลังจ่ายเดิม)', pg.locator('#finSubnav a[data-fin-page="expflow"]').count() == 1 and pg.locator('#finSubnav a[data-fin-page="verification"]').count() == 0)
    pg.click('#fmContent [data-go="#expflow/new"]'); wait_page(pg, 'ขอเบิกค่าใช้จ่าย')
    pg.fill('#ffReq [name=description]', 'ซื้อแก้วกาแฟ 500 ใบ'); pg.fill('#ffReq [name=amount]', '1500'); pg.fill('#ffReq [name=reference]', 'ร้าน A')
    ok('ฟอร์มแสดงยอดสุทธิ', 'ยอดขอเบิกสุทธิ ฿1,500.00' in pg.inner_text('#ffPrev'), pg.inner_text('#ffPrev'))
    pg.set_input_files('#ffReq [name=files]', PDF)
    pg.click('#ffReq [data-save="submit"]'); wait_page(pg, 'ซื้อแก้วกาแฟ')
    doc = pg.evaluate("location.hash.split('/').pop()")
    ok('ส่งขออนุมัติ → หน้ารายละเอียด ขั้น "Owner อนุมัติ"', stage_now(pg) == 'Owner อนุมัติ', stage_now(pg))
    ok('ไฟล์ใบเสนอราคาแนบแล้ว (ชื่อไทย)', 'ใบเสนอราคา.pdf' in pg.inner_text('#fmContent'))
    ok('Staff เห็น "รอ Owner อนุมัติคำขอ" + แนบเพิ่มได้', 'รอ Owner อนุมัติคำขอ' in pg.inner_text('#fmContent') and pg.locator('[data-up="req"]').count() == 1)
    c.close()
    # ---------- 2) Owner ส่งกลับ ----------
    c, pg = open_ctx(p, b, OWN, path='index.html#fin/expflow')
    wait_page(pg, 'เบิก–เคลียร์')
    pg.wait_for_selector('.ff-item', timeout=15000)
    ok('Owner: รายการอยู่ใน "ต้องทำ" + ป้าย "ต้องทำ: อนุมัติคำขอ"', 'ต้องทำ: อนุมัติคำขอ' in pg.inner_text('.ff-item'))
    pg.wait_for_function("(document.querySelector('#finSubnav a[data-fin-page=expflow] b')||{}).textContent==='1'", timeout=10000)
    ok('ตัวเลขงานบนเมนูเบิก–เคลียร์ = 1', True)
    pg.click('.ff-item'); wait_page(pg, 'ซื้อแก้วกาแฟ')
    ok('หน้าอนุมัติของ Owner: มีแค่ อนุมัติ / ส่งกลับ (ไม่มีปุ่มส่งขออนุมัติ แก้ไข แนบไฟล์ แบบผู้เบิก)',
       pg.locator('[data-do="approve-request"]').count() == 1 and pg.locator('[data-do="return-request"]').count() == 1
       and pg.locator('[data-do="submit-request"], [data-up], [data-go^="#expflow/edit:"], [data-do="void"], #ffWht [data-go^="#wht50/new:"]').count() == 0)
    pg.evaluate("location.hash='#fin/document/'+location.hash.split('/').pop()"); wait_page(pg, 'EXP-')
    ok('หน้าเอกสาร (Owner): ไม่มี ส่งอนุมัติ/ยกเลิก + ปุ่มชื่อ "อนุมัติคำขอเบิก"', pg.locator('#fmContent [data-a="submit"], #fmContent [data-a="void"]').count() == 0 and pg.locator('#fmContent [data-a="approve"]').inner_text().strip() == 'อนุมัติคำขอเบิก')
    pg.evaluate("history.back()"); wait_page(pg, 'ซื้อแก้วกาแฟ')
    pg.click('[data-do="return-request"]'); answer(pg, 'ขอใบเสนอราคา 2 ร้าน')
    after_action(pg, "document.querySelector('#fmContent .fm-notice.bad')")
    ok('Owner ส่งกลับ → ขั้น "ขอเบิก" สีแดง + เหตุผล', stage_now(pg) == 'ขอเบิก' and pg.locator('.ff-step.back').count() == 1 and 'ขอใบเสนอราคา 2 ร้าน' in pg.inner_text('#fmContent .fm-notice.bad'))
    c.close()
    # ---------- 3) Staff แก้ → ส่งใหม่ ----------
    c, pg = open_ctx(p, b, STF, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ')
    ok('Staff เห็นเหตุผลที่ส่งกลับ', 'Owner ส่งคำขอกลับ' in pg.inner_text('#fmContent') and 'ขอใบเสนอราคา 2 ร้าน' in pg.inner_text('#fmContent'))
    pg.click('#fmContent [data-go="#expflow/edit:%s"]' % doc); wait_page(pg, 'แก้ไขคำขอ')
    ok('ฟอร์มแก้ไขเติมค่าเดิม', pg.input_value('#ffReq [name=amount]') == '1500' and pg.input_value('#ffReq [name=reference]') == 'ร้าน A')
    pg.fill('#ffReq [name=amount]', '1200'); pg.click('#ffReq [data-save="submit"]'); wait_page(pg, 'ซื้อแก้วกาแฟ')
    ok('แก้แล้วส่งใหม่ → รอ Owner อนุมัติ', stage_now(pg) == 'Owner อนุมัติ')
    c.close()
    # ---------- 4) Owner อนุมัติวงเงิน ----------
    c, pg = open_ctx(p, b, OWN, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ')
    pg.click('[data-do="approve-request"]'); answer(pg)
    after_action(pg, "(document.querySelector('.ff-step[aria-current=step] b')||{}).textContent==='จ่ายเงิน + เคลียร์'")
    ok('Owner อนุมัติ → ขั้น "จ่ายเงิน + เคลียร์" (ยังไม่ลงบัญชี)', True)
    pg.wait_for_selector('#fmContent .fm-notice', timeout=15000)
    ok('Owner หลังอนุมัติ: ไม่มีฟอร์มเคลียร์ของผู้เบิก (เห็นสถานะรอผู้เบิก)', pg.locator('#ffClr, [data-do="submit-clearance"], [data-up]').count() == 0 and 'รอ ผู้เบิกบันทึกจ่ายเงินและเคลียร์' in pg.inner_text('#fmContent'))
    c.close()
    # ---------- 5) Staff บันทึกจ่าย + สลิป + เคลียร์ (คืนเงิน 200) ----------
    c, pg = open_ctx(p, b, STF, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ'); pg.wait_for_selector('#ffClr')
    ok('ฟอร์มเคลียร์: ยอดที่จ่ายตั้งต้น = วงเงินที่อนุมัติ', pg.input_value('#ffClr [name=actual_paid_amount]') == '1200')
    pg.fill('#ffClr [name=actual_expense_amount]', '1000')
    ok('ระบบคำนวณเงินคืน 200.00', pg.input_value('#ffClr [name=refund]') == '200.00', pg.input_value('#ffClr [name=refund]'))
    pg.click('[data-do="submit-clearance"]'); pg.wait_for_timeout(300)
    ok('ส่งโดยยังไม่แนบสลิป → เตือน', 'แนบหลักฐานการจ่าย' in pg.inner_text('#finLayer'))
    pg.set_input_files('[data-up="clr"] input[type=file]', SLIP)
    pg.wait_for_function("document.querySelector('#ffClr') && document.body.innerText.includes('สลิป 1 ไฟล์')", timeout=20000)
    ok('แนบสลิป → บันทึกร่างให้อัตโนมัติ + ยอดที่กรอกยังอยู่', pg.input_value('#ffClr [name=actual_expense_amount]') == '1000')
    pg.click('[data-do="submit-clearance"]')
    after_action(pg, "(document.querySelector('.ff-step[aria-current=step] b')||{}).textContent==='Owner ตรวจเคลียร์'")
    ok('ส่งเคลียร์ → ขั้น "Owner ตรวจเคลียร์" + สรุป จ่าย/ใช้จริง/คืน', '฿200.00' in pg.inner_text('.ff-sum'))
    c.close()
    # ---------- 6) Owner อนุมัติเคลียร์ ----------
    c, pg = open_ctx(p, b, OWN, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ')
    pg.click('[data-do="approve-clearance"]')
    after_action(pg, "(document.querySelector('.ff-step[aria-current=step] b')||{}).textContent==='ผู้ตรวจสุดท้าย'")
    ok('Owner อนุมัติเคลียร์ → ขั้น "ผู้ตรวจสุดท้าย"', True)
    c.close()
    # ---------- 7) ผู้ตรวจสุดท้าย ยืนยัน → ปิดงาน ----------
    c, pg = open_ctx(p, b, VER, path='index.html#fin')
    wait_page(pg, 'เบิก–เคลียร์'); pg.wait_for_selector('.ff-item', timeout=15000)
    ok('ผู้ตรวจสุดท้าย: เริ่มที่หน้าเบิก–เคลียร์ + งานรอตรวจ', 'ต้องทำ: ตรวจขั้นสุดท้าย' in pg.inner_text('.ff-item'))
    pg.click('.ff-item'); wait_page(pg, 'ซื้อแก้วกาแฟ')
    ok('เช็กลิสต์เอกสาร: ใบเสนอราคา + สลิป', pg.locator('.ff-check li.ok').count() >= 2, pg.inner_text('.ff-check'))
    pg.click('[data-do="verify"]'); pg.wait_for_timeout(300)
    ok('ยังไม่ติ๊กยืนยัน → เตือน', 'ติ๊กยืนยัน' in pg.inner_text('#finLayer'))
    pg.check('#ffConfirm'); pg.click('[data-do="verify"]')
    after_action(pg, "document.querySelector('#fmContent').innerText.includes('ปิดงานแล้ว · ลงบัญชี JV-') && document.querySelectorAll('.ff-step.done').length === 6")
    ok('ยืนยัน → ปิดงาน + เลขสมุดรายวัน', pg.locator('.ff-step.done').count() == 6)
    c.close()
    # ---------- 8) Owner เห็นผลในบัญชี ----------
    c, pg = open_ctx(p, b, OWN, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ')
    ok('ประวัติครบทุกขั้น (ส่ง/ส่งกลับ/อนุมัติ/เคลียร์/ปิดงาน)', all(t in pg.inner_text('.ff-time') for t in ['ส่งขออนุมัติ', 'Owner ส่งคำขอกลับ', 'Owner อนุมัติคำขอ', 'ส่งเคลียร์', 'Owner อนุมัติเคลียร์', 'ปิดงาน ลงบัญชีแล้ว']), pg.inner_text('.ff-time'))
    pg.click('#fmContent a[href^="#journal/"]'); wait_page(pg, 'JV-')
    ok('ลิงก์ "ดูรายการบัญชี" → สมุดรายวัน (ค่าใช้จ่าย 1,000 + รับคืน 200)', '1,000.00' in pg.inner_text('#fmContent') and '200.00' in pg.inner_text('#fmContent'))
    pg.evaluate("location.hash='#fin/expflow'"); wait_page(pg, 'เบิก–เคลียร์'); pg.click('#ffTabs [data-tab="closed"]')
    pg.wait_for_selector('.ff-item', timeout=10000)
    ok('แท็บ "ปิดแล้ว" แสดงยอดใช้จริง ฿1,000.00', '฿1,000.00' in pg.inner_text('.ff-item') and 'ปิดงานแล้ว' in pg.inner_text('.ff-item'))
    c.close()
    # ---------- 9) มือถือ ----------
    c, pg = open_ctx(p, b, STF, mobile=True, path='index.html#fin/expflow/' + doc)
    wait_page(pg, 'ซื้อแก้วกาแฟ')
    over = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
    ok('มือถือ: หน้ารายละเอียดไม่ล้นจอ (ขั้นตอนเลื่อนในแถบ)', over <= 1 and pg.evaluate("getComputedStyle(document.querySelector('.ff-stepper')).overflowX") == 'auto', over)
    pg.screenshot(path='/tmp/fe2e/flow-m-detail.png', full_page=True)
    pg.evaluate("location.hash='#fin/expflow/new'"); wait_page(pg, 'ขอเบิกค่าใช้จ่าย')
    ok('มือถือ: ฟอร์มขอเบิกไม่ล้นจอ', pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1)
    pg.screenshot(path='/tmp/fe2e/flow-m-form.png', full_page=True)
    c.close()
    print('errors', ERR)
print(f'ผ่าน {sum(R)} / {len(R)}')
