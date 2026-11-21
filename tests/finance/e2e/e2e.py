import json, urllib.request, uuid, subprocess, concurrent.futures as cf
API = 'http://localhost:8000/'
OWN, ACC, APR, VIEW, NOB, MGR, STF, VER = 'tok_owner_123', 'tok_acc_12345', 'tok_appr_1234', 'tok_view_1234', 'tok_nobody_12', 'tok_mgr_12345', 'tok_staff_1234', 'tok_verifier_12'
R = []
def ok(name, cond, extra=''):
    R.append(bool(cond)); print(('✓ ' if cond else '✗ ') + name, ('' if cond else extra))
def call(tok, action=None, body=None, idem=None, **q):
    if body is None:
        qs = '&'.join(f'{k}={urllib.parse.quote(str(v))}' for k, v in {'action': action, **q}.items() if v is not None)
        req = urllib.request.Request(API + '?' + qs)
    else:
        req = urllib.request.Request(API, data=json.dumps({'action': action, **body}).encode(), method='POST')
        req.add_header('content-type', 'application/json')
        if idem: req.add_header('idempotency-key', idem)
    if tok: req.add_header('x-cms-session', tok)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
import urllib.parse
def post(tok, action, idem=None, **body): return call(tok, action, body, idem)
def get(tok, action, **q): return call(tok, action, None, None, **q)
def upload_file(tok, payment_id, category, filename='proof.pdf', mime='application/pdf', data=b'%PDF-1.4 finance test proof'):
    boundary = '----finance-' + uuid.uuid4().hex
    parts = []
    for name, value in [('action', 'file.upload'), ('payment_id', payment_id), ('category', category)]:
        parts.append(b'--' + boundary.encode() + b'\r\n')
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(b'--' + boundary.encode() + b'\r\n')
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
    parts.append(f'Content-Type: {mime}\r\n\r\n'.encode())
    parts.append(data + b'\r\n--' + boundary.encode() + b'--\r\n')
    req = urllib.request.Request(API, data=b''.join(parts), method='POST')
    req.add_header('content-type', f'multipart/form-data; boundary={boundary}')
    if tok: req.add_header('x-cms-session', tok)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as err: return err.code, json.loads(err.read() or b'{}')
def psql(q): return subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5544', '-U', 'postgres', '-d', 'fin', '-tA', '-c', q], capture_output=True, text=True).stdout.strip()
def journal_lines(doc_id):
    return psql(f"select string_agg(code||':'||dr||'/'||cr, ' ' order by code) from (select a.account_code code, sum(jl.debit) dr, sum(jl.credit) cr from finance.journal_lines jl join finance.journal_entries je on je.id=jl.journal_entry_id join finance.chart_of_accounts a on a.id=jl.account_id where je.source_document_id='{doc_id}' and je.source_type='document' group by 1) x")
D = '2026-11-'
def k(): return str(uuid.uuid4())

print('— การยืนยันตัวตนและสิทธิ์ —')
s, r = get(None, 'session'); ok('ไม่มี token → 401', s == 401)
s, r = get('tok_expired_xx', 'session'); ok('Session หมดอายุ → 401 + ข้อความให้เข้าสู่ระบบใหม่', s == 401 and 'เข้าสู่ระบบ' in r['error'], r)
s, r = get(OWN, 'session'); ok('Owner ของ CMS → Finance Owner อัตโนมัติ', s == 200 and r['data']['actor']['role'] == 'owner' and r['data']['actor']['ref'] == 'owner', r)
s, r = get(NOB, 'session'); ok('ผู้ใช้ที่ยังไม่ได้รับสิทธิ์ → 403', s == 403 and 'สิทธิ์' in r['error'], r)
s, r = get(OWN, 'cms-users'); ok('Owner ดึงรายชื่อผู้ใช้ CMS (ไม่รวม owner)', s == 200 and {x['actor_ref'] for x in r['data']['items']} == {'u:U1', 'u:U2', 'u:U3', 'u:U4', 'u:U5', 'u:U6', 'u:U7'}, r)
for ref, role, name in [('u:U1', 'accountant', 'Accountant A'), ('u:U2', 'approver', 'Approver B'), ('u:U3', 'viewer', 'Viewer C')]:
    s, r = post(OWN, 'user.set', actor_ref=ref, role=role, display_name=name); ok(f'ให้สิทธิ์ {role}', s == 200, r)
s, r = post(OWN, 'user.set', actor_ref='u:U4', role='owner'); ok('ให้สิทธิ์ owner กับผู้ใช้อื่นไม่ได้', s == 400, r)
for ref, role, name in [('u:U5', 'manager', 'Manager M'), ('u:U6', 'staff', 'Staff S'), ('u:U7', 'verifier', 'Partner Verifier')]:
    s, r = post(OWN, 'user.set', actor_ref=ref, role=role, display_name=name); ok(f'กำหนด Finance role {role}', s == 200 and r['data']['role_code'] == role, r)
s, r = get(MGR, 'session'); ok('Manager สร้างคำขอได้แต่อนุมัติไม่ได้', s == 200 and r['data']['capabilities']['request'] and not r['data']['capabilities']['approve'] and not r['data']['capabilities']['verify'], r)
s, r = get(STF, 'session'); ok('Staff สร้างคำขอได้แต่อนุมัติไม่ได้', s == 200 and r['data']['capabilities']['request'] and not r['data']['capabilities']['approve'], r)
s, r = get(VER, 'session'); ok('Final Verifier ตรวจเอกสารได้ แต่อนุมัติ/บันทึกไม่ได้', s == 200 and r['data']['capabilities']['verify'] and not r['data']['capabilities']['approve'] and not r['data']['capabilities']['request'] and not r['data']['capabilities']['write'], r)
s, r = get(MGR, 'approvals'); ok('Manager เปิดคิวอนุมัติไม่ได้', s == 403, r)
s, r = get(STF, 'summary'); ok('Staff ดูภาพรวมทางการเงินทั้งบริษัทไม่ได้', s == 403, r)
s, r = get(VER, 'summary'); ok('Final Verifier ดูรายงานทางการเงินไม่ได้', s == 403, r)
s, r = post(ACC, 'user.set', actor_ref='u:U4', role='viewer'); ok('ผู้บันทึกบัญชีจัดการผู้ใช้ไม่ได้', s == 403, r)
s, r = get(ACC, 'session'); ok('ผู้บันทึกบัญชีเข้าได้ role=accountant', s == 200 and r['data']['actor']['role'] == 'accountant' and r['data']['capabilities'] == {'read': True, 'request': True, 'write': True, 'approve': False, 'verify': False, 'admin': False}, r)
s, r = post(VIEW, 'partner.save', partner_type='vendor', display_name='X'); ok('ผู้ดูอย่างเดียวบันทึกไม่ได้', s == 403, r)
s, r = post(ACC, 'setup.defaults'); ok('ผู้บันทึกบัญชีตั้งค่าเริ่มต้นไม่ได้', s == 403, r)

print('— ตั้งค่าเริ่มต้น —')
s, r = post(OWN, 'setup.defaults', year=2026); ok('สร้างผังบัญชี 29 บัญชี + รอบบัญชี 12 เดือน', s == 200 and r['data']['accounts_created'] == 29 and r['data']['periods_created'] == 12, r)
s, r = post(OWN, 'setup.defaults', year=2026); ok('กดซ้ำไม่สร้างซ้ำ', s == 200 and r['data']['accounts_created'] == 0 and r['data']['periods_created'] == 0, r)
s, r = post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True, fiscal_year_start_month=1); ok('แก้ข้อมูลบริษัท + จด VAT', s == 200 and r['data']['vat_registered'] is True, r)
s, r = post(OWN, 'company.update', legal_name='x', tax_id='123'); ok('เลขผู้เสียภาษีผิดรูปแบบ → 400', s == 400, r)
acc = {a['account_code']: a['id'] for a in get(OWN, 'accounts')[1]['data']['items']}

print('— คู่ค้า —')
s, r = post(ACC, 'partner.save', partner_type='customer', display_name='บริษัท ลูกค้า จำกัด', tax_id='0105566000002'); cust = r['data']['id']; ok('เพิ่มลูกค้า', s == 200, r)
s, r = post(ACC, 'partner.save', partner_type='vendor', display_name='บริษัท ผู้ขาย จำกัด', tax_id='0105566000003', default_wht_type='pnd53', default_wht_rate=3); vend = r['data']['id']; ok('เพิ่มผู้ขาย (ภ.ง.ด.53)', s == 200, r)
s, r = post(ACC, 'partner.save', partner_type='vendor', display_name='นาย ช่างซ่อม', default_wht_type='pnd3'); vend3 = r['data']['id']; ok('เพิ่มผู้ขายบุคคล (ภ.ง.ด.3)', s == 200, r)
s, r = post(ACC, 'partner.save', partner_type='vendor', display_name='bad', tax_id='12'); ok('เลขผู้เสียภาษีคู่ค้าผิด → 400', s == 400, r)

print('— รายรับ (ใบกำกับภาษี) —')
inv_key = k()
s, r = post(ACC, 'document.create', idem=inv_key, document_type='tax_invoice', document_date=D + '05', due_date=D + '20', partner_id=cust, vat_rate=7,
            lines=[{'description': 'กาแฟ', 'quantity': 100, 'unit_price': 60}, {'description': 'เบเกอรี่', 'quantity': 40, 'unit_price': 100}])
inv = r['data']; ok('สร้างใบกำกับภาษี 10,000 + VAT 700', s == 201 and float(inv['grand_total']) == 10700 and inv['document_number'].startswith('TIV-202611-'), r)
s, r = post(ACC, 'document.create', idem=inv_key, document_type='tax_invoice', document_date=D + '05', partner_id=cust, vat_rate=7, lines=[{'description': 'x', 'quantity': 1, 'unit_price': 1}])
ok('ส่งซ้ำด้วย Idempotency Key เดิม → ได้เอกสารเดิม', s == 201 and r['data']['id'] == inv['id'] and r['data'].get('duplicate'), r)
s, r = post(ACC, 'document.approve', document_id=inv['id']); ok('อนุมัติร่างที่ยังไม่ส่งตรวจไม่ได้ (สิทธิ์)', s == 403, r)
s, r = post(ACC, 'document.submit', document_id=inv['id']); ok('ส่งตรวจ', s == 200 and r['data']['status'] == 'pending_review', r)
s, r = post(APR, 'document.approve', document_id=inv['id']); ok('ผู้อนุมัติอนุมัติ → ลงบัญชีอัตโนมัติ', s == 200 and r['data']['status'] == 'posted' and r['data']['journal_number'].startswith('JV-202611-'), r)
ok('สมุดรายวัน: Dr ลูกหนี้ 10,700 / Cr รายได้ 10,000 + ภาษีขาย 700', journal_lines(inv['id']) == '1100:10700.00/0.00 2100:0.00/700.00 4000:0.00/10000.00', journal_lines(inv['id']))
s, r = post(ACC, 'document.update', document_id=inv['id'], document_date=D + '05', vat_rate=7, lines=[{'description': 'x', 'quantity': 1, 'unit_price': 1}]); ok('แก้เอกสารที่ลงบัญชีแล้วไม่ได้', s == 409, r)
ok('DB: แก้ยอดเอกสาร posted ตรงๆ ถูกบล็อก', 'locked' in subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5544', '-U', 'postgres', '-d', 'fin', '-c', f"update finance.documents set grand_total=1 where id='{inv['id']}'"], capture_output=True, text=True).stderr)

print('— รายจ่าย + หัก ณ ที่จ่าย —')
s, r = post(ACC, 'document.create', idem=k(), document_type='bill', document_date=D + '06', partner_id=vend, vat_rate=7, wht_rate=3, submit=True,
            lines=[{'description': 'ค่าเช่าเครื่อง', 'quantity': 1, 'unit_price': 5000, 'account_code': '5200'}])
bill = r['data']; ok('บิลค่าเช่า 5,000 + VAT 350 − หัก 3% 150 = 5,200 (ส่งตรวจทันที)', s == 201 and float(bill['grand_total']) == 5200 and bill['status'] == 'pending_review', r)
s, r = post(APR, 'document.approve', document_id=bill['id']); ok('อนุมัติบิล', s == 200, r)
ok('สมุดรายวัน: Dr ค่าเช่า 5,000 + ภาษีซื้อ 350 / Cr เจ้าหนี้ 5,200 + หัก ณ ที่จ่ายค้างจ่าย 150', journal_lines(bill['id']) == '1150:350.00/0.00 2000:0.00/5200.00 2120:0.00/150.00 5200:5000.00/0.00', journal_lines(bill['id']))
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '06', partner_id=vend3, wht_rate=3, submit=True, lines=[{'description': 'ค่าซ่อม', 'quantity': 1, 'unit_price': 1000, 'account_code': '5600'}])
s, r = post(APR, 'document.approve', document_id=r['data']['id']); ok('ค่าซ่อมจากบุคคล (ภ.ง.ด.3) อนุมัติได้', s == 200, r)

print('— Maker–Checker —')
s, r = post(APR, 'document.create', idem=k(), document_type='expense', document_date=D + '07', vat_rate=0, submit=True, lines=[{'description': 'ค่าน้ำแข็ง', 'quantity': 1, 'unit_price': 300}])
own_doc = r['data']['id']
s, r = post(APR, 'document.approve', document_id=own_doc); ok('ผู้อนุมัติอนุมัติเอกสารที่ตัวเองสร้างไม่ได้', s == 403 and 'Maker' in r['error'], r)
s, r = post(OWN, 'document.approve', document_id=own_doc); ok('Owner (คนละคน) อนุมัติได้', s == 200, r)
s, r = post(OWN, 'document.create', idem=k(), document_type='expense', document_date=D + '07', submit=True, lines=[{'description': 'ค่าแก๊ส', 'quantity': 1, 'unit_price': 500}]); od = r['data']['id']
s, r = post(OWN, 'document.approve', document_id=od); ok('Owner อนุมัติของตัวเองไม่ได้ (ค่าเริ่มต้น)', s == 403, r)
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True, allow_self_approval=True)
s, r = post(OWN, 'document.approve', document_id=od); ok('เปิด "อนุมัติตนเองได้" → Owner อนุมัติได้ + บันทึกเป็น approve_self', s == 200 and psql(f"select count(*) from finance.audit_events where entity_id='{od}' and action='approve_self'") == '1', r)
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True, allow_self_approval=False)

print('— ตีกลับ / ยกเลิก / กลับรายการ / ใบลดหนี้ —')
s, r = post(ACC, 'document.create', idem=k(), document_type='invoice', document_date=D + '08', partner_id=cust, vat_rate=7, submit=True, lines=[{'description': 'จัดเลี้ยง', 'quantity': 1, 'unit_price': 2000}]); rd = r['data']['id']
s, r = post(APR, 'document.return', document_id=rd); ok('ตีกลับต้องมีเหตุผล', s == 400, r)
s, r = post(APR, 'document.return', document_id=rd, note='แก้ราคา'); ok('ตีกลับ → ร่าง', s == 200 and r['data']['status'] == 'draft', r)
s, r = post(ACC, 'document.update', document_id=rd, document_date=D + '08', partner_id=cust, vat_rate=7, lines=[{'description': 'จัดเลี้ยง', 'quantity': 1, 'unit_price': 2500}]); ok('แก้ร่าง → 2,675', s == 200 and float(r['data']['grand_total']) == 2675, r)
post(ACC, 'document.submit', document_id=rd); s, r = post(APR, 'document.approve', document_id=rd); ok('ส่งตรวจใหม่แล้วอนุมัติ', s == 200, r)
s, r = post(APR, 'document.reverse', document_id=rd, reason='บันทึกผิดลูกค้า'); ok('กลับรายการเอกสารที่ลงบัญชีแล้ว', s == 200 and r['data']['status'] == 'reversed' and r['data']['reversal_journal'], r)
ok('ภาษีของเอกสารที่กลับรายการ → adjusted', psql(f"select status from finance.tax_transactions where document_id='{rd}'") == 'adjusted')
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '09', lines=[{'description': 'ร่างทดสอบ', 'quantity': 1, 'unit_price': 50}]); vd = r['data']['id']
s, r = post(ACC, 'document.void', document_id=vd, reason='ซ้ำ'); ok('ยกเลิกร่าง', s == 200 and r['data']['status'] == 'voided', r)
s, r = post(ACC, 'document.create', idem=k(), document_type='credit_note', document_date=D + '10', partner_id=cust, vat_rate=7, submit=True, lines=[{'description': 'คืนสินค้า', 'quantity': 1, 'unit_price': 1000}]); cn = r['data']['id']
s, r = post(APR, 'document.approve', document_id=cn); ok('ใบลดหนี้อนุมัติ', s == 200, r)
ok('ใบลดหนี้: Dr รายได้ 1,000 + ภาษีขาย 70 / Cr ลูกหนี้ 1,070', journal_lines(cn) == '1100:0.00/1070.00 2100:70.00/0.00 4000:1000.00/0.00', journal_lines(cn))

print('— ไม่ได้จด VAT —')
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=False)
s, r = post(ACC, 'document.create', idem=k(), document_type='invoice', document_date=D + '11', vat_rate=7, lines=[{'description': 'x', 'quantity': 1, 'unit_price': 100}]); ok('ไม่ได้จด VAT → เก็บภาษีขายไม่ได้', s == 400, r)
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '11', vat_rate=7, submit=True, lines=[{'description': 'ซื้อแก้ว', 'quantity': 1, 'unit_price': 1000}]); nv = r['data']['id']
s, r = post(APR, 'document.approve', document_id=nv)
ok('ไม่ได้จด VAT → ภาษีซื้อรวมเป็นค่าใช้จ่าย (Dr 5900 1,070)', journal_lines(nv) == '2000:0.00/1070.00 5900:1070.00/0.00' and psql(f"select count(*) from finance.tax_transactions where document_id='{nv}'") == '0', journal_lines(nv))
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True)

print('— รับ / จ่ายเงิน —')
s, r = post(ACC, 'payment.create', idem=k(), payment_type='receipt', payment_date=D + '12', amount=999999, method='bank_transfer', document_id=inv['id']); ok('รับเกินยอดคงค้าง → 400', s == 400, r)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '12', amount=100, method='cash', document_id=inv['id']); ok('ประเภทไม่ตรงเอกสาร → 400', s == 400, r)
s, r = post(ACC, 'payment.create', payment_type='receipt', payment_date=D + '12', amount=100, method='cash', document_id=inv['id']); ok('ไม่มี Idempotency Key → 400', s == 400, r)
pk = k()
with cf.ThreadPoolExecutor(5) as ex: res = list(ex.map(lambda _: post(ACC, 'payment.create', idem=pk, payment_type='receipt', payment_date=D + '12', amount=5000, method='bank_transfer', document_id=inv['id']), range(5)))
ids = {x[1]['data']['id'] for x in res if x[0] == 201}
ok('ส่งพร้อมกัน 5 ครั้ง key เดียวกัน → รายการเดียว', len(ids) == 1 and psql(f"select count(*) from finance.payments where idempotency_key='{pk}'") == '1', res)
pay = ids.pop()
s, r = post(ACC, 'payment.approve', payment_id=pay); ok('ผู้บันทึกอนุมัติการรับเงินไม่ได้', s == 403, r)
s, r = post(APR, 'payment.mark-paid', payment_id=pay); ok('ยังไม่อนุมัติ → บันทึกรับเงินไม่ได้', s == 409, r)
s, r = post(APR, 'payment.approve', payment_id=pay); ok('อนุมัติการรับเงิน', s == 200 and r['data']['status'] == 'approved', r)
s, r = post(APR, 'payment.mark-paid', payment_id=pay); ok('บันทึกรับเงินจริง → ลงบัญชี', s == 200 and r['data']['status'] == 'paid' and r['data']['journal_number'], r)
ok('สมุดรายวันรับเงิน: Dr ธนาคาร 5,000 / Cr ลูกหนี้ 5,000', psql(f"select string_agg(a.account_code||':'||jl.debit||'/'||jl.credit,' ' order by a.account_code) from finance.journal_lines jl join finance.journal_entries je on je.id=jl.journal_entry_id join finance.chart_of_accounts a on a.id=jl.account_id where je.source_payment_id='{pay}'") == '1010:5000.00/0.00 1100:0.00/5000.00')
s, r = get(ACC, 'open-documents', kind='income'); o = {x['id']: float(x['outstanding']) for x in r['data']['items']}; ok('ยอดคงค้างใบกำกับ = 5,700', o.get(inv['id']) == 5700, o)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '13', amount=5200, method='bank_transfer', offset_account_id=acc['5200']); bp = r['data']['id']
s, r = post(APR, 'payment.reject', payment_id=bp, note='รอใบเสร็จ'); ok('ปฏิเสธการจ่าย', s == 200 and r['data']['status'] == 'rejected', r)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '13', amount=5200, method='bank_transfer', document_id=bill['id']); bp2 = r['data']['id']
s, r = post(ACC, 'payment.cancel', payment_id=bp2, note='ผิด'); ok('ยกเลิกรายการที่อนุมัติแล้วแต่ยังไม่จ่าย', s == 200 and r['data']['status'] == 'cancelled', r)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '13', amount=5200, method='bank_transfer', document_id=bill['id']); bp3 = r['data']['id']
s, r = post(APR, 'payment.mark-paid', payment_id=bp3); ok('จ่ายบิลที่ Owner/Approver อนุมัติในเอกสารแล้วได้โดยไม่อนุมัติซ้ำ', s == 200, r)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='receipt', payment_date=D + '14', amount=50000, method='bank_transfer', offset_account_id=acc['3000'], note='เจ้าของนำเงินเข้า'); cap = r['data']['id']
post(APR, 'payment.approve', payment_id=cap); s, r = post(APR, 'payment.mark-paid', payment_id=cap); ok('รับเงินไม่มีเอกสาร (บัญชีคู่ = ทุน)', s == 200, r)
s, r = post(APR, 'document.reverse', document_id=bill['id'], reason='x'); ok('กลับรายการเอกสารที่จ่ายแล้วไม่ได้', s == 409, r)

print('— สมุดรายวันทั่วไป —')
s, r = post(ACC, 'journal.create', journal_date=D + '15', description='ไม่สมดุล', lines=[{'account_id': acc['1000'], 'debit': 100}, {'account_id': acc['3000'], 'credit': 90}]); ok('ไม่สมดุล → 400', s == 400, r)
s, r = post(ACC, 'journal.create', journal_date=D + '15', description='ถอนเงินจากธนาคารเข้าลิ้นชัก', lines=[{'account_id': acc['1000'], 'debit': 2000}, {'account_id': acc['1010'], 'credit': 2000}]); jv = r['data']; ok('สร้างสมุดรายวัน (รออนุมัติ)', s == 201 and jv['status'] == 'pending_review', r)
s, r = post(ACC, 'journal.post', journal_id=jv['id']); ok('ผู้บันทึกลงบัญชีเองไม่ได้', s == 403, r)
s, r = post(APR, 'journal.post', journal_id=jv['id']); ok('ผู้อนุมัติลงบัญชี', s == 200 and r['data']['status'] == 'posted', r)
s, r = post(ACC, 'journal.create', journal_date=D + '15', description='ตีกลับทดสอบ', lines=[{'account_id': acc['5900'], 'debit': 10}, {'account_id': acc['1000'], 'credit': 10}]); j2 = r['data']['id']
s, r = post(APR, 'journal.reject', journal_id=j2, note='ไม่มีหลักฐาน'); ok('ตีกลับสมุดรายวัน → ร่าง', s == 200 and r['data']['status'] == 'draft', r)
s, r = post(ACC, 'journal.submit', journal_id=j2); ok('ส่งตรวจใหม่', s == 200, r)
post(APR, 'journal.reject', journal_id=j2, note='x'); s, r = post(ACC, 'journal.delete', journal_id=j2); ok('ลบร่างสมุดรายวัน', s == 200, r)
s, r = post(APR, 'journal.reverse', journal_id=jv['id'], reason='โอนผิด', reversal_date=D + '16'); ok('กลับรายการสมุดรายวัน', s == 200 and r['data']['journal_number'], r)
s, r = post(APR, 'journal.reverse', journal_id=jv['id'], reason='ซ้ำ', reversal_date=D + '16'); ok('กลับรายการซ้ำไม่ได้', s == 409, r)

print('— ภาษี —')
s, r = get(ACC, 'tax-report', period='2026-11'); t = r['data']['totals']
ok('รายงานภาษี: ขาย 700−70=630, ซื้อ 350, ภ.ง.ด.53 150, ภ.ง.ด.3 30', t['vat_output'] == 630 and t['vat_input'] == 350 and t['pnd53'] == 150 and t['pnd3'] == 30, t)
s, r = post(ACC, 'tax.prepare', form_code='PP30', period='2026-11'); pp = r['data']; ok('จัดทำ ภ.พ.30 → ต้องชำระ 280', s == 200 and pp['return_amount'] == 280 and pp['due_date'] == '2026-12-23', r)
s, r = post(ACC, 'tax.prepare', form_code='PP30', period='2026-11'); ok('จัดทำซ้ำได้ระหว่างกำลังจัดทำ', s == 200 and r['data']['id'] == pp['id'], r)
s, r = post(ACC, 'tax.submit-review', filing_id=pp['id']); ok('ส่งตรวจแบบ', s == 200, r)
s, r = post(ACC, 'tax.approve', filing_id=pp['id']); ok('ผู้บันทึกอนุมัติแบบไม่ได้', s == 403, r)
s, r = post(APR, 'tax.approve', filing_id=pp['id']); ok('อนุมัติ ภ.พ.30 → ลงบัญชีปิดภาษี', s == 200 and r['data']['journal_number'], r)
ok('รายการภาษีขาย/ซื้อของงวด → filed', psql("select count(*) from finance.tax_transactions where tax_period='2026-11' and tax_type like 'vat%' and status='filed'") == '3')
s, r = post(APR, 'tax.mark-submitted', filing_id=pp['id']); ok('ต้องมีเลขอ้างอิงการยื่น', s == 400, r)
s, r = post(APR, 'tax.mark-submitted', filing_id=pp['id'], receipt_reference='RD-PP30-TEST-0001', submitted_at='2026-12-10'); ok('บันทึกว่ายื่นแล้ว', s == 200 and r['data']['status'] == 'submitted', r)
s, r = post(APR, 'tax.mark-paid', filing_id=pp['id'], paid_date='2026-12-10'); ok('บันทึกชำระภาษี → ลงบัญชี', s == 200 and r['data']['journal_number'], r)
s, r = post(ACC, 'tax.prepare', form_code='PND53', period='2026-11'); ok('จัดทำ ภ.ง.ด.53 = 150', s == 200 and r['data']['return_amount'] == 150, r)
s, r = post(ACC, 'tax.prepare', form_code='PP30', period='2026-11'); ok('จัดทำ ภ.พ.30 ซ้ำหลังยื่นแล้วไม่ได้', s == 409, r)
s, r = post(APR, 'document.reverse', document_id=inv['id'], reason='x'); ok('กลับรายการเอกสารที่ภาษียื่นแล้ว/มีรับเงินไม่ได้', s == 409, r)

print('— รอบบัญชี —')
s, r = get(OWN, 'periods'); nov = [p for p in r['data']['items'] if p['period_code'] == '2026-11'][0]
post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '20', submit=True, lines=[{'description': 'ค้างอนุมัติ', 'quantity': 1, 'unit_price': 10}])
s, r = post(OWN, 'period.close', period_id=nov['id']); ok('ปิดรอบที่มีรายการค้าง → 409 บอกสาเหตุ', s == 409 and 'ยังไม่อนุมัติ' in r['error'], r)
s, r = post(ACC, 'period.close', period_id=nov['id']); ok('ผู้บันทึกปิดรอบไม่ได้', s == 403, r)
pend = get(APR, 'approvals')[1]['data']
for d in pend['documents']: post(APR, 'document.void', document_id=d['id'], reason='ปิดรอบ')
s, r = post(OWN, 'period.close', period_id=nov['id'], note='ปิดงวด พ.ย.'); ok('ปิดรอบ พ.ย.', s == 200 and r['data']['status'] == 'closed', r)
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '21', submit=True, lines=[{'description': 'หลังปิดรอบ', 'quantity': 1, 'unit_price': 10}]); late = r['data']['id']
s, r = post(APR, 'document.approve', document_id=late); ok('ลงบัญชีในรอบที่ปิดไม่ได้', s == 409 and 'ปิดแล้ว' in r['error'], r)
s, r = post(OWN, 'period.reopen', period_id=nov['id']); ok('เปิดรอบใหม่ต้องมีเหตุผล', s == 400, r)
s, r = post(OWN, 'period.reopen', period_id=nov['id'], reason='ปรับปรุงรายการ'); ok('เปิดรอบใหม่', s == 200 and r['data']['status'] == 'reopened', r)
s, r = post(APR, 'document.approve', document_id=late); ok('ลงบัญชีได้หลังเปิดรอบ', s == 200, r)

print('— รายงาน —')
s, r = get(VIEW, 'trial-balance', **{'from': '2026-11-01', 'to': '2026-12-31'}); tb = r['data']; ok('งบทดลองสมดุล (ผู้ดูอ่านได้)', s == 200 and tb['totals']['balanced'] and tb['totals']['debit'] > 0, tb['totals'])
s, r = get(OWN, 'profit-loss', **{'from': '2026-11-01', 'to': '2026-11-30'}); pl = r['data']['totals']
ok('กำไรขาดทุน: รายได้ 9,000 (10,000−1,000) ค่าใช้จ่าย 7,880', pl['revenue'] == 9000 and pl['expense'] == 7880, pl)
s, r = get(OWN, 'balance-sheet', as_of='2026-12-31'); bs = r['data']['totals']; ok('งบดุลสมดุล', bs['balanced'], bs)
s, r = get(OWN, 'ledger', account_id=acc['1100'], **{'from': '2026-11-01', 'to': '2026-11-30'}); ok('บัญชีแยกประเภทลูกหนี้: ยอดยกไป 4,630', r['data']['closing'] == 4630, r['data'].get('closing'))
s, r = get(OWN, 'aging', kind='ar', as_of='2026-12-31'); ok('อายุลูกหนี้: ลูกค้าค้าง 5,700 (เกิน 30 วัน)', r['data']['totals'].get('total') == 5700 and r['data']['totals'].get('d31_60') == 5700, r['data']['totals'])
s, r = get(OWN, 'summary'); ok('ภาพรวมโหลดได้', s == 200 and 'kpi' in r['data'], r)
s, r = get(VIEW, 'audit'); ok('ผู้ดูอย่างเดียวดูประวัติไม่ได้', s == 403, r)
s, r = get(APR, 'audit'); ok('ผู้อนุมัติดูประวัติได้', s == 200 and len(r['data']['items']) > 10, r)

print('— แยกข้อมูลระหว่างบริษัท —')
other = psql("insert into finance.companies(legal_name, environment) values ('Other Co','production') returning id").splitlines()[0]
op = psql(f"insert into finance.partners(company_id, partner_type, display_name) values ('{other}','vendor','Other Vendor') returning id").splitlines()[0]
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '22', partner_id=op, lines=[{'description': 'x', 'quantity': 1, 'unit_price': 1}]); ok('อ้างอิงคู่ค้าของบริษัทอื่นไม่ได้', s == 400, r)
s, r = get(OWN, 'document', id=psql(f"insert into finance.documents(company_id,document_type,document_date) values ('{other}','expense','2026-11-01') returning id").splitlines()[0]); ok('อ่านเอกสารของบริษัทอื่นไม่ได้', s == 404, r)
psql(f"delete from finance.documents where company_id='{other}'"); psql(f"delete from finance.partners where company_id='{other}'"); psql(f"delete from finance.companies where id='{other}'")

print('— Manager / Staff / Final Verifier —')
s, r = post(STF, 'document.create', idem=k(), document_type='expense', document_date=D + '23', partner_id=vend, submit=True,
            lines=[{'description': 'อุปกรณ์สำนักงาน', 'quantity': 1, 'unit_price': 500, 'account_code': '5200'}])
staff_doc = r['data']; ok('Staff สร้างคำขอรายจ่ายและส่ง Owner ได้', s == 201 and staff_doc['status'] == 'pending_review', r)
s, r = post(MGR, 'document.approve', document_id=staff_doc['id']); ok('Manager อนุมัติเอกสารไม่ได้', s == 403, r)
s, r = post(STF, 'document.approve', document_id=staff_doc['id']); ok('Staff อนุมัติเอกสารไม่ได้', s == 403, r)
s, r = post(OWN, 'document.approve', document_id=staff_doc['id']); ok('Owner อนุมัติคำขอ Staff', s == 200 and staff_doc['id'] == r['data']['id'], r)
s, r = post(STF, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '23', amount=500, method='bank_transfer', document_id=staff_doc['id'])
staff_pay = r['data']['id']; ok('Staff สร้างคำขอจ่ายเงินที่ได้รับอนุมัติตามเอกสารที่ Owner อนุมัติแล้ว', s == 201 and r['data']['status'] == 'approved' and r['data']['approved_by'] == 'u:U0', r)
s, r = post(MGR, 'payment.approve', payment_id=staff_pay); ok('Manager อนุมัติการจ่ายไม่ได้', s == 403, r)
s, r = post(STF, 'payment.approve', payment_id=staff_pay); ok('Staff อนุมัติการจ่ายไม่ได้', s == 403, r)
s, r = post(OWN, 'payment.approve', payment_id=staff_pay); ok('ไม่ต้องขอ Owner อนุมัติการจ่ายซ้ำเมื่ออนุมัติเอกสารรายจ่ายแล้ว', s == 409, r)
s, r = post(STF, 'payment.mark-paid', payment_id=staff_pay); ok('Staff บันทึกว่าจ่ายเงินจริงได้ทันทีหลัง Owner อนุมัติเอกสาร', s == 200 and r['data']['status'] == 'paid', r)
s, r = get(STF, 'document', id=bill['id']); ok('Staff เปิดเอกสารของผู้ใช้อื่นไม่ได้', s == 404, r)
s, r = get(STF, 'payments'); ok('Staff เห็นเฉพาะรายการรับ/จ่ายของตนเอง', s == 200 and all(x['created_by'] == 'u:U6' for x in r['data']['items']), r)
s, r = get(MGR, 'summary'); ok('Manager ดูภาพรวมตามสิทธิ์ได้', s == 200 and 'kpi' in r['data'], r)
company_id = psql('select id from finance.companies order by created_at limit 1')
s, r = upload_file(STF, staff_pay, 'payment_evidence'); staff_file = r['data']
ok('Staff แนบหลักฐานการจ่ายจริงผ่าน private Storage', s == 201 and staff_file['payment_id'] == staff_pay and staff_file['file_category'] == 'payment_evidence', r)
s, r = get(VER, 'verification-queue'); q = [x for x in r['data']['items'] if x['id'] == staff_pay]
ok('Final Verifier เห็นหลักฐานของรายการจ่ายที่ชำระแล้ว', s == 200 and len(q) == 1 and q[0]['file_count'] == 1 and q[0]['evidence_count'] == 1, q)
s, r = get(VER, 'file-url', file_id=staff_file['id']); ok('Final Verifier เปิดเอกสารผ่าน signed URL ชั่วคราว', s == 200 and r['data']['url'].startswith('http://127.0.0.1:8760/signed/'), r)
s, r = post(MGR, 'payment.verify-documents', payment_id=staff_pay, confirm_complete=True); ok('Manager ยืนยันเอกสารขั้นสุดท้ายไม่ได้', s == 403, r)
s, r = post(STF, 'payment.verify-documents', payment_id=staff_pay, confirm_complete=True); ok('Staff ยืนยันเอกสารขั้นสุดท้ายไม่ได้', s == 403, r)
s, r = post(VER, 'payment.approve', payment_id=staff_pay); ok('Final Verifier อนุมัติการจ่ายไม่ได้', s == 403, r)
s, r = post(VER, 'payment.verify-documents', payment_id=staff_pay, confirm_complete=True); ok('Final Verifier ติ๊กยืนยันเอกสารครบถ้วน', s == 200 and r['data']['status'] == 'verified' and r['data']['verified_by'] == 'u:U7', r)
s, r = get(VER, 'verification-queue'); q = [x for x in r['data']['items'] if x['id'] == staff_pay]
ok('ระบบบันทึกผู้ตรวจและสถานะ Verified & Completed', s == 200 and len(q) == 1 and q[0]['verification_status'] == 'verified' and q[0]['verified_by'] == 'u:U7', q)
s, r = upload_file(STF, staff_pay, 'receipt_invoice'); ok('เพิ่มไฟล์หลัง Final Verification แล้วไม่ได้', s == 409, r)
s, r = get(VER, 'payments'); ok('Final Verifier ไม่สามารถเปิดหน้ารายการรับ/จ่ายทั่วไปได้', s == 403, r)

print('— ล้างข้อมูลทดสอบ / เริ่มใช้งานจริง —')
s, r = post(OWN, 'company.purge-test-data', confirm='ผิด'); ok('ล้างข้อมูลต้องพิมพ์ยืนยัน', s == 400, r)
s, r = post(APR, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('ผู้อนุมัติล้างข้อมูลไม่ได้', s == 403, r)
s, r = post(OWN, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('ล้างข้อมูลทดสอบ (เก็บการตั้งค่า)', s == 200 and r['data']['deleted']['documents'] > 5, r)
ok('หลังล้าง: เอกสาร 0, ผังบัญชี 29, คู่ค้า 3, รอบบัญชีเปิดทั้งหมด, ประวัติ = เฉพาะการล้าง',
   psql("select count(*) from finance.documents")+'|'+psql("select count(*) from finance.chart_of_accounts")+'|'+psql("select count(*) from finance.partners")+'|'+psql("select count(*) from finance.accounting_periods where status<>'open'")+'|'+psql("select string_agg(action,',') from finance.audit_events") == '0|29|3|0|purge_test_data',
   psql("select string_agg(action,',') from finance.audit_events"))
ok('หลังล้าง: ลบประวัติ final verification และ metadata ไฟล์แนบแล้ว',
   psql("select count(*) from finance.payment_verifications") == '0' and psql("select count(*) from finance.document_files") == '0')
s, r = post(OWN, 'company.go-live', confirm='เริ่มใช้งานจริง'); ok('ชื่อบริษัทยังเป็นชื่อทดสอบ → เริ่มใช้งานจริงไม่ได้', s == 409, r)
post(OWN, 'company.update', legal_name='บริษัท คาเฟ่ ทดลอง จำกัด'.replace('ทดลอง', 'ตัวอย่าง'), tax_id='0105566000001', vat_registered=True)
s, r = post(OWN, 'company.go-live', confirm='เริ่มใช้งานจริง'); ok('เริ่มใช้งานจริง', s == 200 and r['data']['environment'] == 'production', r)
s, r = get(OWN, 'session'); ok('Session แสดง production', r['data']['company']['environment'] == 'production', r)
s, r = post(OWN, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('หลังใช้งานจริง ล้างข้อมูลไม่ได้', s == 409, r)
ok('DB: ล้างข้อมูลบริษัทจริงไม่ได้แม้เรียกฟังก์ชันตรง', 'UAT' in subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5544', '-U', 'postgres', '-d', 'fin', '-c', "select finance.purge_company_transactions((select id from finance.companies limit 1))"], capture_output=True, text=True).stderr)
s, r = get(ACC, 'session'); ok('ผู้ใช้เดิมยังเข้าได้หลังเริ่มใช้งานจริง', s == 200, r)
print(f'\nผ่าน {sum(R)} / {len(R)}')
