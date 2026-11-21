import json, re, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8767/'
FIN = BASE + 'modules/finance/finance.html?standalone=1'
REMOTE = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api'
R = []; ERR = []
def ok(n, c, x=''):
    R.append(bool(c)); print(('✓ ' if c else '✗ ') + n, '' if c else x)

def route(r):
    url = r.request.url.replace(REMOTE, 'http://localhost:8000/')
    if r.request.method == 'OPTIONS':
        return r.fulfill(status=200, headers={'access-control-allow-origin': 'http://localhost:8767', 'access-control-allow-headers': 'content-type, x-cms-session, idempotency-key, x-request-id', 'access-control-allow-methods': 'GET, POST, OPTIONS'})
    resp = r.fetch(url=url)
    r.fulfill(response=resp)

def ctx(p, browser, tok, mobile=False):
    c = browser.new_context(**(p.devices['iPhone 13'] if mobile else {'viewport': {'width': 1366, 'height': 900}}))
    c.route(REMOTE + '**', route)
    c.route('**/fonts.g*/**', lambda r: r.abort())
    pg = c.new_page()
    pg.on('pageerror', lambda e: ERR.append(str(e)[:200]))
    pg.on('console', lambda m: ERR.append('console: ' + m.text[:200]) if m.type == 'error' and 'favicon' not in m.text else None)
    pg.goto(BASE + 'modules/finance/css/fin-ui.css')
    pg.evaluate(f"sessionStorage.setItem('amz.tok','{tok}')")
    pg.goto(FIN); pg.wait_for_selector('.fm-page-head h1', timeout=15000)
    return c, pg

import urllib.request, uuid
def apipost(tok, action, **body):
    req = urllib.request.Request('http://localhost:8000/', data=json.dumps({'action': action, **body}).encode(), method='POST', headers={'content-type': 'application/json', 'x-cms-session': tok})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def apiupload(tok, fields):
    bd = '----t' + uuid.uuid4().hex; parts = []
    for k, v in fields.items(): parts += [f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()]
    parts += [f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="slip.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode(), b'%PDF-1.4 x\r\n', f'--{bd}--\r\n'.encode()]
    req = urllib.request.Request('http://localhost:8000/', data=b''.join(parts), method='POST', headers={'content-type': f'multipart/form-data; boundary={bd}', 'x-cms-session': tok})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())
# รายจ่ายลงบัญชีตอนปิดงานเคลียร์ (ทดสอบหน้าจอเคลียร์เต็มใน flow_ui.py) — ที่นี่ปิดผ่าน API ให้ตัวเลขภาษี/งบถูกต้อง
def close_bills(maker, approver, verifier):
    import subprocess
    ids = subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5544', '-U', 'postgres', '-d', 'fin', '-tA', '-c',
        "select d.id||'|'||d.grand_total||'|'||d.document_date from finance.documents d where d.status='approved' and d.document_type in ('expense','bill','payment_voucher')"], capture_output=True, text=True).stdout.split()
    n = 0
    for row in ids:
        did, amt, dd = row.split('|')
        body = dict(document_id=did, actual_paid_amount=float(amt), actual_expense_amount=float(amt), payment_date=dd, payment_method='bank_transfer')
        s, r = apipost(maker, 'expense-clearance.submit', submit=False, **body)
        apiupload(maker, {'action': 'expense-clearance.file.upload', 'clearance_id': r['data']['id'], 'category': 'payment_evidence'})
        apipost(maker, 'expense-clearance.submit', **body)
        apipost(approver, 'expense-clearance.approve', clearance_id=r['data']['id'])
        s, r = apipost(verifier, 'expense-clearance.verify', clearance_id=r['data']['id'], confirm_complete=True); n += s == 200
    return n

def toast(pg, timeout=12000):
    t = pg.wait_for_selector('.fm-toast:not(.out)', timeout=timeout)
    s = t.inner_text(); pg.evaluate("document.querySelectorAll('.fm-toast').forEach(t=>t.remove())"); return s

def go(pg, h):
    pg.evaluate("document.getElementById('fmContent').insertAdjacentHTML('beforeend','<i id=fmStale></i>')")
    pg.evaluate(f"(location.hash==='{h}'||(location.hash===''&&'{h}'==='#dashboard'))?FIN.reload():location.hash='{h}'")
    pg.wait_for_selector('#fmStale', state='detached', timeout=15000); pg.wait_for_selector('.fm-content .fm-page-head', timeout=15000); pg.wait_for_function("!document.querySelector('.fm-content .fm-loading')", timeout=15000)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- Owner (PC) ----
    c, o = ctx(p, b, 'tok_owner_123')
    ok('Owner เปิด Finance → หน้าภาพรวม + เช็กลิสต์เริ่มต้น', 'เริ่มต้นใช้งาน' in o.inner_text('#fmContent'))
    ok('แสดงโหมดทดสอบ (UAT)', 'ทดสอบ' in o.inner_text('#fmMode'))
    ok('เมนูรออนุมัติ/ผู้ใช้/ตั้งค่าแสดงสำหรับ Owner', o.is_visible('[data-page=approvals]') and o.locator('[data-page=users]').get_attribute('hidden') is None)
    o.click('#fmSetup'); s = toast(o); ok('กดตั้งค่าเริ่มต้น', 'สร้างผังบัญชี 29' in s, s)
    go(o, '#company'); o.check('[name=vat_registered]'); o.fill('[name=tax_id]', '0105566000001'); o.click('#fmCo .fm-btn-primary'); s = toast(o); ok('บันทึกข้อมูลบริษัท (จด VAT)', 'บันทึกแล้ว' in s, s)
    go(o, '#users'); o.click('#fmAddU'); o.wait_for_selector('#fmU select[name=actor_ref] option[value="u:U1"]', state='attached')
    o.select_option('#fmU [name=actor_ref]', 'u:U1'); o.select_option('#fmU [name=role]', 'accountant'); o.click('#fmU .fm-btn-primary'); toast(o)
    o.click('#fmAddU'); o.wait_for_selector('#fmU select[name=actor_ref] option[value="u:U2"]', state='attached')
    o.select_option('#fmU [name=actor_ref]', 'u:U2'); o.select_option('#fmU [name=role]', 'approver'); o.click('#fmU .fm-btn-primary'); toast(o)
    go(o, '#users'); t = o.inner_text('#fmContent'); ok('ให้สิทธิ์ผู้บันทึกบัญชี + ผู้อนุมัติผ่านหน้าจอ', 'Accountant A' in t and 'Approver B' in t, t[:300])

    # ---- Accountant (iPhone) ----
    c2, a = ctx(p, b, 'tok_acc_12345', mobile=True)
    ok('ผู้บันทึกบัญชีไม่เห็นเมนูผู้ใช้/ตั้งค่า', a.locator('[data-page=users]').get_attribute('hidden') is not None and a.locator('[data-page=settings]').get_attribute('hidden') is not None)
    go(a, '#income/new')
    a.click('#fmAddP'); a.fill('#fmPQ [name=display_name]', 'บริษัท ลูกค้าทดสอบ จำกัด'); a.fill('#fmPQ [name=tax_id]', '0105566000002'); a.click('#fmPQ .fm-btn-primary'); toast(a)
    a.select_option('[name=document_type]', 'tax_invoice')
    a.fill('#fmLines tr:nth-child(1) [name=description]', 'กาแฟจัดเลี้ยง'); a.fill('#fmLines tr:nth-child(1) [name=quantity]', '100'); a.fill('#fmLines tr:nth-child(1) [name=unit_price]', '50')
    a.click('#fmAddLine'); a.fill('#fmLines tr:nth-child(2) [name=description]', 'เบเกอรี่'); a.fill('#fmLines tr:nth-child(2) [name=quantity]', '10'); a.fill('#fmLines tr:nth-child(2) [name=unit_price]', '100')
    tot = a.inner_text('#fmTot'); ok('ฟอร์มคำนวณยอดสด: 6,000 + VAT 420 = 6,420', '6,000.00' in tot and '420.00' in tot and '6,420.00' in tot, tot)
    a.click('[data-mode=submit]'); s = toast(a); a.wait_for_selector('.fm-head-actions'); a.wait_for_function("document.querySelector('.fm-page-head h1').textContent.startsWith('TIV-')")
    t = a.inner_text('#fmContent'); ok('บันทึกและส่งอนุมัติ → หน้าเอกสาร สถานะรออนุมัติ', 'รออนุมัติ' in t and 'TIV-' in t, s + t[:200])
    doc_url = a.evaluate('location.hash')
    go(a, '#expense/new')
    a.select_option('[name=document_type]', 'bill'); a.check('[name=wht_enabled][value=yes]'); a.select_option('[name=wht_rate]', '3')
    a.fill('#fmLines tr:nth-child(1) [name=description]', 'ค่าเช่าเครื่องชงกาแฟ'); a.fill('#fmLines tr:nth-child(1) [name=unit_price]', '2000'); a.select_option('#fmLines tr:nth-child(1) [name=account_code]', '5200')
    tot = a.inner_text('#fmTot'); ok('บิลหัก 3%: 2,000 + 140 − 60 = 2,080', '2,080.00' in tot and '60.00' in tot, tot)
    a.click('[data-mode=submit]'); toast(a)
    ok('ผู้บันทึกบัญชีไม่เห็นปุ่มอนุมัติในหน้าเอกสาร', a.locator('[data-a=approve]').count() == 0)

    # ---- Approver (PC) ----
    c3, v = ctx(p, b, 'tok_appr_1234')
    v.wait_for_function("!document.querySelector('#fmApprovalsBadge').hidden", timeout=10000)
    ok('ตัวเลขรออนุมัติบนเมนู = 2', v.inner_text('#fmApprovalsBadge') == '2', v.inner_text('#fmApprovalsBadge'))
    go(v, '#approvals')
    n0 = v.locator('[data-act=doc-approve]').count()
    v.locator('[data-act=doc-approve]').first.click(); s = toast(v); ok('อนุมัติเอกสารจากกล่องรออนุมัติ (รายได้ → ลงบัญชีทันที · รายจ่าย → รอเคลียร์)', 'ลงบัญชี JV-' in s or 'ลงบัญชีตอนปิดงาน' in s, s)
    v.wait_for_timeout(600); v.locator('[data-act=doc-approve]').first.click(); s = toast(v); ok('อนุมัติเอกสารที่ 2', 'ลงบัญชี' in s, s)
    apipost('tok_owner_123', 'user.set', actor_ref='u:U7', role='verifier', display_name='Verifier V')
    ok('บิลค่าเช่า: เคลียร์ + ผู้ตรวจสุดท้ายปิดงาน (ผ่าน API) → ลงบัญชี', close_bills('tok_acc_12345', 'tok_appr_1234', 'tok_verifier_12') == 1)

    # ---- รับเงิน (accountant) ----
    go(a, doc_url.lstrip('#') and doc_url)
    a.click('[data-a=pay]'); a.wait_for_selector('#fmPay'); a.fill('#fmPay [name=amount]', '3000'); a.click('#fmPay .fm-btn-primary'); s = toast(a); ok('ผู้บันทึกบันทึกรับเงินบางส่วน (รออนุมัติ)', 'รออนุมัติ' in s, s)
    go(v, '#approvals'); v.locator('[data-act=pay-approve]').first.click(); toast(v)
    v.wait_for_timeout(500); v.locator('[data-act=pay-paid]').first.click(); v.click('#fmAskOk'); s = toast(v); ok('ผู้อนุมัติอนุมัติ + บันทึกรับเงินจริง → ลงบัญชี', 'ลงบัญชี JV-' in s, s)
    go(a, doc_url); t = a.inner_text('#fmContent'); ok('หน้าเอกสารแสดงรับแล้ว 3,000 คงค้าง 3,420', '3,000.00' in t and '3,420.00' in t, t[:500])

    # ---- สมุดรายวัน ----
    go(a, '#journals'); a.click('#fmNewJ'); a.wait_for_selector('#fmJ')
    a.fill('#fmJ [name=description]', 'ยอดยกมา เงินสด/ทุน')
    a.select_option('#fmJL tr:nth-child(1) [name=account_id]', label='1000 เงินสด'); a.fill('#fmJL tr:nth-child(1) [name=debit]', '10000')
    a.select_option('#fmJL tr:nth-child(2) [name=account_id]', label='3000 ทุน'); a.fill('#fmJL tr:nth-child(2) [name=credit]', '10000')
    jt = a.inner_text('#fmJT')
    if 'สมดุล' not in jt: a.screenshot(path='/tmp/fe2e/fail-j.png', full_page=True); print('DEBUG', a.evaluate("[document.querySelectorAll('.fm-overlay').length, [...document.querySelectorAll('#fmJL tr')].map(tr=>[tr.querySelector('[name=account_id]').value.slice(0,6), tr.querySelector('[name=debit]').value, tr.querySelector('[name=credit]').value])]"))
    ok('สมุดรายวันแสดงสมดุล', 'สมดุล' in jt, jt)
    a.click('#fmJ .fm-btn-primary'); s = toast(a); ok('บันทึกสมุดรายวัน (รออนุมัติ)', 'รออนุมัติ' in s, s)
    go(v, '#approvals'); v.locator('[data-act=je-post]').first.click(); s = toast(v); ok('ผู้อนุมัติลงบัญชีสมุดรายวัน', 'ลงบัญชีแล้ว' in s, s)

    # ---- ภาษี ----
    go(a, '#vat'); t = a.inner_text('#fmContent'); ok('รายงาน VAT: ขาย 420 ซื้อ 140 ต้องชำระ 280', '420.00' in t and '140.00' in t and '280.00' in t, t[:400])
    go(a, '#filings'); a.select_option('#fmFForm', 'PP30'); a.click('#fmFPrep'); s = toast(a); ok('จัดทำ ภ.พ.30', '280' in s, s)
    a.wait_for_selector('[data-f=review]'); a.click('[data-f=review]'); toast(a)
    go(v, '#filings'); v.click('[data-f=approve]'); v.click('#fmAskOk'); s = toast(v); ok('ผู้อนุมัติอนุมัติ ภ.พ.30', 'อนุมัติ' in s, s)
    v.wait_for_selector('[data-f=filed]'); v.click('[data-f=filed]'); v.fill('#fmAskIn', 'RD-REF-001'); v.click('#fmAskOk'); v.wait_for_selector('#fmAskIn[type=date]'); v.click('#fmAskOk'); s = toast(v); ok('บันทึกว่ายื่นแบบแล้ว', 'บันทึก' in s, s)

    # ---- รายงาน ----
    go(o, '#profit-loss'); t = o.inner_text('#fmR'); ok('งบกำไรขาดทุน: รายได้ 6,000 ค่าใช้จ่าย 2,000 กำไร 4,000', '6,000.00' in t and '2,000.00' in t and '4,000.00' in t, t[:400])
    go(o, '#trial-balance'); ok('งบทดลองสมดุล', 'สมดุล' in o.inner_text('#fmR'))
    go(o, '#balance-sheet'); t = o.inner_text('#fmR'); ok('งบแสดงฐานะการเงินแสดงผล (ไม่มีแจ้งไม่สมดุล)', 'รวมสินทรัพย์' in t and 'ไม่สมดุล' not in t, t[:300])
    go(o, '#aging'); ok('อายุลูกหนี้แสดงลูกค้าค้าง 3,420', '3,420.00' in o.inner_text('#fmR'))
    go(o, '#ledger'); ok('บัญชีแยกประเภทโหลดได้', 'ยอดยกมา' in o.inner_text('#fmR'))
    for h in ['#dashboard', '#income', '#expense', '#payments', '#partners', '#accounts', '#periods', '#journals', '#wht', '#audit', '#settings']:
        go(o, h)
    ok('ทุกหน้าโหลดได้ไม่มี error', not ERR, ERR[:5])
    go(o, '#dashboard'); t = o.inner_text('#fmContent'); ok('ภาพรวมแสดงรายได้เดือนนี้ 6,000', '฿6,000.00' in t, t[:400])

    # ---- มือถือ: ภาพหน้าจอ ----
    for h, name in [('#dashboard', 'm-dash'), (doc_url, 'm-doc'), ('#income/new', 'm-form'), ('#approvals', 'm-appr')]:
        if h == '#approvals': go(v, h); v.screenshot(path=f'/tmp/fe2e/{name}-pc.png', full_page=True)
        else: go(a, h); a.screenshot(path=f'/tmp/fe2e/{name}.png', full_page=True)
    over = a.evaluate("(()=>{const w=document.documentElement.clientWidth;return [...document.querySelectorAll('.fm-content *')].filter(e=>e.getBoundingClientRect().right>w+2&&!e.closest('.fm-table-wrap')).slice(0,5).map(e=>e.className||e.tagName)})()")
    ok('มือถือ: ไม่มีส่วนใดล้นจอ', not over, over)

    # ---- ล้างข้อมูลทดสอบ ----
    go(o, '#settings'); o.click('#fmPurge'); o.fill('#fmAskIn', 'ผิด'); o.click('#fmAskOk'); s = toast(o); ok('พิมพ์ยืนยันผิด → ไม่ล้าง', 'ให้ตรง' in s, s)
    o.fill('#fmAskIn', 'ล้างข้อมูลทดสอบ'); o.click('#fmAskOk'); s = toast(o); ok('ล้างข้อมูลทดสอบผ่านหน้าจอ', 'ล้างข้อมูลทดสอบแล้ว' in s, s)
    go(o, '#income'); ok('หลังล้าง: ไม่มีเอกสาร', 'ยังไม่มีเอกสาร' in o.inner_text('#fmContent'))
    # ---- ไม่มี session ----
    c4 = b.new_context(); pg4 = c4.new_page(); pg4.goto(FIN); pg4.wait_for_selector('.fm-page-head h1')
    ok('ไม่มี CMS Session → หน้าให้เข้าสู่ระบบหลังร้าน', 'เข้าสู่ระบบ CMS' in pg4.inner_text('#fmContent'))
    c5, nb = ctx(p, b, 'tok_nobody_12'); ok('ผู้ใช้ไม่มีสิทธิ์ → แจ้งให้ Owner เพิ่มสิทธิ์', 'ยังไม่ได้รับสิทธิ์' in nb.inner_text('#fmContent'))
    print('errors:', ERR[:8])
print(f'\nผ่าน {sum(R)} / {len(R)}')
