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
def upload_to(tok, fields, filename='proof.pdf', mime='application/pdf', data=b'%PDF-1.4 finance test proof'):
    boundary = '----finance-' + uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
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
def jl_clear(doc_id):
    return psql(f"select string_agg(code||':'||dr||'/'||cr, ' ' order by code) from (select a.account_code code, sum(jl.debit) dr, sum(jl.credit) cr from finance.journal_lines jl join finance.journal_entries je on je.id=jl.journal_entry_id join finance.chart_of_accounts a on a.id=jl.account_id where je.source_document_id='{doc_id}' and je.source_type='expense_clearance' group by 1) x")
# เบิก–เคลียร์จนปิดงาน: บันทึกร่าง → แนบสลิป → ส่ง → ผู้อนุมัติตรวจเคลียร์ → ผู้ตรวจสุดท้ายยืนยัน (= ลงบัญชี)
def close_expense(doc_id, maker, approver=None, verifier=None, date=None, method='bank_transfer', paid=None, expense=None, verify=True):
    approver = approver or APR; verifier = verifier or VER
    amt = float(psql(f"select grand_total from finance.documents where id='{doc_id}'"))
    paid = amt if paid is None else paid
    s, r = post(maker, 'expense-clearance.submit', document_id=doc_id, submit=False, actual_paid_amount=paid, actual_expense_amount=paid if expense is None else expense,
                payment_date=date or D + '06', payment_method=method)
    if s != 200: return s, r, None
    cid = r['data']['id']
    upload_to(maker, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'payment_evidence'})
    s, r = post(maker, 'expense-clearance.submit', document_id=doc_id, submit=True, actual_paid_amount=paid, actual_expense_amount=paid if expense is None else expense,
                payment_date=date or D + '06', payment_method=method)
    if s != 200: return s, r, cid
    s, r = post(approver, 'expense-clearance.approve', clearance_id=cid)
    if s != 200 or not verify: return s, r, cid
    s, r = post(verifier, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True)
    return s, r, cid

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
s, r = post(APR, 'document.approve', document_id=bill['id']); ok('อนุมัติคำขอ (บิล) → ยังไม่ลงบัญชี รอเคลียร์', s == 200 and r['data']['status'] == 'approved' and r['data']['accounting_posted'] is False and journal_lines(bill['id']) == '', r)
s, r, _ = close_expense(bill['id'], ACC, date=D + '06')
ok('เคลียร์ + ผู้ตรวจปิดงาน → Dr ค่าเช่า 5,000 + ภาษีซื้อ 350 / Cr ธนาคาร 5,200 + หัก ณ ที่จ่ายค้างจ่าย 150', s == 200 and jl_clear(bill['id']) == '1010:0.00/5200.00 1150:350.00/0.00 2120:0.00/150.00 5200:5000.00/0.00', (r, jl_clear(bill['id'])))
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '06', partner_id=vend3, wht_rate=3, submit=True, lines=[{'description': 'ค่าซ่อม', 'quantity': 1, 'unit_price': 1000, 'account_code': '5600'}])
rep_id = r['data']['id']; s, r = post(APR, 'document.approve', document_id=rep_id); ok('ค่าซ่อมจากบุคคล (ภ.ง.ด.3) อนุมัติได้', s == 200, r)
s, r, _ = close_expense(rep_id, ACC, date=D + '06', method='cash'); ok('เคลียร์ค่าซ่อม (เงินสด) ปิดงาน', s == 200 and jl_clear(rep_id) == '1000:0.00/970.00 2120:0.00/30.00 5600:1000.00/0.00', (r, jl_clear(rep_id)))

print('— Maker–Checker —')
s, r = post(APR, 'document.create', idem=k(), document_type='expense', document_date=D + '07', vat_rate=0, submit=True, lines=[{'description': 'ค่าน้ำแข็ง', 'quantity': 1, 'unit_price': 300}])
own_doc = r['data']['id']
s, r = post(APR, 'document.approve', document_id=own_doc); ok('ผู้อนุมัติอนุมัติเอกสารที่ตัวเองสร้างไม่ได้', s == 403 and 'Maker' in r['error'], r)
s, r = post(OWN, 'document.approve', document_id=own_doc); ok('Owner (คนละคน) อนุมัติได้', s == 200, r)
s, r, _ = close_expense(own_doc, APR, approver=OWN, date=D + '07'); ok('ผู้อนุมัติเบิกเอง → Owner ตรวจเคลียร์ → ผู้ตรวจปิดงาน', s == 200, r)
s, r = post(OWN, 'document.create', idem=k(), document_type='expense', document_date=D + '07', submit=True, lines=[{'description': 'ค่าแก๊ส', 'quantity': 1, 'unit_price': 500}]); od = r['data']['id']
s, r = post(OWN, 'document.approve', document_id=od); ok('Owner อนุมัติของตัวเองไม่ได้ (ค่าเริ่มต้น)', s == 403, r)
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True, allow_self_approval=True)
s, r = post(OWN, 'document.approve', document_id=od); ok('เปิด "อนุมัติตนเองได้" → Owner อนุมัติได้ + บันทึกเป็น approve_self', s == 200 and psql(f"select count(*) from finance.audit_events where entity_id='{od}' and action='approve_self'") == '1', r)
post(OWN, 'company.update', legal_name='Café Amazon – CMS Finance Test Workspace', tax_id='0105566000001', vat_registered=True, allow_self_approval=False)
s, r, oc = close_expense(od, OWN, approver=OWN, date=D + '07'); ok('Owner อนุมัติเคลียร์ของตัวเองไม่ได้ (ปิดอนุมัติตนเอง)', s == 403, r)
s, r = post(APR, 'expense-clearance.approve', clearance_id=oc); s, r = post(VER, 'expense-clearance.verify', clearance_id=oc, confirm_complete=True); ok('ผู้อนุมัติคนอื่นตรวจเคลียร์ → ผู้ตรวจปิดงาน', s == 200, r)

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
s, r = post(APR, 'document.approve', document_id=nv); s, r, _ = close_expense(nv, ACC, date=D + '11')
ok('ไม่ได้จด VAT → ภาษีซื้อรวมเป็นค่าใช้จ่าย (Dr 5900 1,070 / Cr ธนาคาร)', s == 200 and jl_clear(nv) == '1010:0.00/1070.00 5900:1070.00/0.00' and psql(f"select count(*) from finance.tax_transactions where document_id='{nv}'") == '0', (r, jl_clear(nv)))
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
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '13', amount=100, method='bank_transfer', offset_account_id=acc['5200']); bp2 = r['data']['id']
post(APR, 'payment.approve', payment_id=bp2); s, r = post(ACC, 'payment.cancel', payment_id=bp2, note='ผิด'); ok('ยกเลิกรายการที่อนุมัติแล้วแต่ยังไม่จ่าย', s == 200 and r['data']['status'] == 'cancelled', r)
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=D + '13', submit=True, lines=[{'description': 'รอเคลียร์', 'quantity': 1, 'unit_price': 80}]); wait_doc = r['data']['id']; post(APR, 'document.approve', document_id=wait_doc)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='disbursement', payment_date=D + '13', amount=80, method='bank_transfer', document_id=wait_doc); ok('จ่ายเงินแยกตามคำขอเบิกที่ยังไม่ปิดเคลียร์ไม่ได้ (ต้องผ่านขั้นเคลียร์)', s == 409, r)
s, r = post(ACC, 'payment.create', idem=k(), payment_type='receipt', payment_date=D + '14', amount=50000, method='bank_transfer', offset_account_id=acc['3000'], note='เจ้าของนำเงินเข้า'); cap = r['data']['id']
post(APR, 'payment.approve', payment_id=cap); s, r = post(APR, 'payment.mark-paid', payment_id=cap); ok('รับเงินไม่มีเอกสาร (บัญชีคู่ = ทุน)', s == 200, r)

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
s, r = post(APR, 'document.approve', document_id=late); ok('อนุมัติคำขอได้แม้รอบปิด (ยังไม่ลงบัญชี)', s == 200, r)
s, r, late_c = close_expense(late, ACC, date=D + '21'); ok('ปิดงานเคลียร์ในรอบที่ปิดไม่ได้', s == 409 and 'ปิดแล้ว' in r['error'], r)
s, r = post(OWN, 'period.reopen', period_id=nov['id']); ok('เปิดรอบใหม่ต้องมีเหตุผล', s == 400, r)
s, r = post(OWN, 'period.reopen', period_id=nov['id'], reason='ปรับปรุงรายการ'); ok('เปิดรอบใหม่', s == 200 and r['data']['status'] == 'reopened', r)
s, r = post(VER, 'expense-clearance.verify', clearance_id=late_c, confirm_complete=True); ok('ลงบัญชีได้หลังเปิดรอบ', s == 200, r)

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

print('— เบิก–เคลียร์ค่าใช้จ่าย ตามแผนภาพ (Manager / Staff / Owner / Final Verifier) —')
FD = '2026-11-24'
def flow(tok, doc): return get(tok, 'expense-flow-item', id=doc)
# 1) Staff สร้างคำขอ (ร่าง) + แนบใบเสนอราคา → ส่งขออนุมัติ
s, r = post(STF, 'document.create', idem=k(), document_type='expense', document_date=FD, lines=[{'description': 'ซื้อแก้วกาแฟ', 'quantity': 1, 'unit_price': 1000, 'account_code': '5200'}])
sd = r['data']['id']; ok('Staff สร้างคำขอเบิก (ร่าง)', s == 201 and r['data']['status'] == 'draft', r)
s, r = upload_to(STF, {'action': 'expense-request.file.upload', 'document_id': sd, 'category': 'quotation'}, filename='ใบเสนอราคา ร้าน A.pdf')
qf = r.get('data', {}); ok('แนบใบเสนอราคาตอนขอเบิก (ชื่อไฟล์ภาษาไทยไม่เพี้ยน)', s == 201 and qf['document_id'] == sd and qf['original_name'] == 'ใบเสนอราคา ร้าน A.pdf', r)
s, r = upload_to(STF, {'action': 'expense-request.file.upload', 'document_id': sd, 'category': 'payment_evidence'}); ok('ประเภทไฟล์ผิดขั้น → 400', s == 400, r)
s, r = post(STF, 'document.submit', document_id=sd); ok('ส่งขออนุมัติ', s == 200, r)
s, r = get(STF, 'expense-flow', tab='todo'); ok('Staff: คำขอที่รอ Owner ไม่อยู่ใน "ต้องทำ" ของ Staff', s == 200 and sd not in [x['id'] for x in r['data']['items']], r)
s, r = get(OWN, 'expense-flow', tab='todo'); it = [x for x in r['data']['items'] if x['id'] == sd]
ok('Owner: คำขออยู่ใน "ต้องทำ" ขั้น รออนุมัติคำขอ', s == 200 and it and it[0]['stage'] == 'request_review' and r['data']['counts']['todo'] >= 1, r['data'].get('counts'))
# 2) Owner ส่งกลับ → Staff แก้ → ส่งใหม่ → Owner อนุมัติ (ยังไม่ลงบัญชี)
s, r = post(MGR, 'document.approve', document_id=sd); ok('Manager อนุมัติคำขอไม่ได้', s == 403, r)
s, r = post(OWN, 'document.return', document_id=sd, note='ขอใบเสนอราคา 2 ร้าน'); ok('Owner ส่งกลับคำขอ (ต้องมีเหตุผล)', s == 200 and r['data']['status'] == 'draft', r)
s, r = flow(STF, sd); ok('Staff เห็นว่าถูกส่งกลับ + เหตุผล + ปุ่มแก้ไข', s == 200 and r['data']['item']['returned'] == 'owner_request' and r['data']['item']['return_note'] == 'ขอใบเสนอราคา 2 ร้าน' and r['data']['actions']['edit_request'], r.get('data', {}).get('item'))
s, r = post(STF, 'document.update', document_id=sd, document_date=FD, lines=[{'description': 'ซื้อแก้วกาแฟ', 'quantity': 1, 'unit_price': 1200, 'account_code': '5200'}]); ok('Staff แก้ยอดเป็น 1,200', s == 200 and float(r['data']['grand_total']) == 1200, r)
post(STF, 'document.submit', document_id=sd)
s, r = post(OWN, 'document.approve', document_id=sd); ok('Owner อนุมัติวงเงิน → ยังไม่ลงบัญชี', s == 200 and r['data']['accounting_posted'] is False and psql(f"select count(*) from finance.journal_entries where source_document_id='{sd}'") == '0', r)
s, r = flow(STF, sd); ok('ขั้นถัดไป: รอบันทึกจ่าย/เคลียร์ (Staff กดเคลียร์ได้)', r['data']['item']['stage'] == 'to_clear' and r['data']['actions']['clear'] and len(r['data']['pay_accounts']) >= 2, r['data']['actions'])
# 3) บันทึกจ่ายเงิน + หลักฐาน + เคลียร์ (ใช้จริง 1,000 คืน 200)
s, r = post(STF, 'expense-clearance.submit', document_id=sd, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash'); ok('ส่งเคลียร์โดยยังไม่บันทึกร่าง/แนบสลิปไม่ได้', s == 409, r)
s, r = post(STF, 'expense-clearance.submit', document_id=sd, submit=False, actual_paid_amount=1500, actual_expense_amount=1500, payment_date=FD, payment_method='cash'); ok('จ่ายเกินวงเงินที่อนุมัติไม่ได้', s == 400 and 'วงเงิน' in r['error'], r)
s, r = post(STF, 'expense-clearance.submit', document_id=sd, submit=False, actual_paid_amount=1200, actual_expense_amount=1300, payment_date=FD, payment_method='cash'); ok('ค่าใช้จ่ายจริงมากกว่ายอดที่จ่ายไม่ได้', s == 400, r)
s, r = post(STF, 'expense-clearance.submit', document_id=sd, submit=False, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash', reference_number='ADV-001')
cid = r['data']['id']; ok('บันทึกร่างเคลียร์: จ่าย 1,200 ใช้จริง 1,000 → เงินคืน 200 (คำนวณให้)', s == 200 and float(r['data']['refund_amount']) == 200 and r['data']['status'] == 'draft', r)
s, r = post(STF, 'expense-clearance.submit', document_id=sd, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash'); ok('ส่งเคลียร์โดยไม่มีหลักฐานการจ่าย → 409', s == 409 and 'หลักฐาน' in r['error'], r)
s, r = upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'payment_evidence'}, filename='slip.jpg', mime='image/jpeg', data=b'\xff\xd8\xff test'); ev = r.get('data', {})
ok('แนบหลักฐานการจ่ายเงิน', s == 201 and ev.get('clearance_id') == cid, r)
s, r = upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'supporting'}); wrong = r['data']['id']
s, r = post(STF, 'expense-file.delete', file_id=wrong); ok('ลบไฟล์ที่แนบผิดได้ระหว่างร่าง', s == 200, r)
upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'refund_evidence'})
upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'receipt_invoice'})
s, r = post(STF, 'expense-clearance.submit', document_id=sd, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash', reference_number='ADV-001')
ok('ส่งเคลียร์ → รอ Owner ตรวจ', s == 200 and r['data']['status'] == 'pending_owner_review' and r['data']['next_step'] == 'owner_review', r)
s, r = upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'supporting'}); ok('ส่งแล้วแนบเพิ่มไม่ได้', s == 409, r)
s, r = post(STF, 'expense-file.delete', file_id=ev['id']); ok('ส่งแล้วลบไฟล์ไม่ได้', s == 409, r)
# 4) Owner ตรวจเคลียร์: ส่งกลับ → แก้ → ส่งใหม่ (กลับไป Owner) → อนุมัติ
s, r = post(VER, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True); ok('ผู้ตรวจสุดท้ายยืนยันก่อน Owner อนุมัติไม่ได้', s == 409, r)
s, r = post(MGR, 'expense-clearance.approve', clearance_id=cid); ok('Manager อนุมัติเคลียร์ไม่ได้', s == 403, r)
s, r = post(OWN, 'expense-clearance.return', clearance_id=cid); ok('Owner ส่งกลับต้องมีเหตุผล', s == 400, r)
s, r = post(OWN, 'expense-clearance.return', clearance_id=cid, note='ขอใบเสร็จตัวจริง'); ok('Owner ส่งกลับเคลียร์', s == 200 and r['data']['status'] == 'returned' and r['data']['returned_stage'] == 'owner', r)
s, r = flow(STF, sd); ok('Staff เห็น "Owner ส่งกลับ" + เหตุผล', r['data']['item']['returned'] == 'owner_clear' and r['data']['item']['return_note'] == 'ขอใบเสร็จตัวจริง' and r['data']['actions']['clear'], r['data']['item'])
upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'tax_invoice'})
s, r = post(STF, 'expense-clearance.submit', document_id=sd, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash'); ok('แก้แล้วส่งใหม่ → กลับไป Owner', s == 200 and r['data']['status'] == 'pending_owner_review', r)
s, r = post(OWN, 'expense-clearance.approve', clearance_id=cid); ok('Owner อนุมัติเคลียร์ → รอผู้ตรวจสุดท้าย', s == 200 and r['data']['status'] == 'owner_approved', r)
# 5) ผู้ตรวจสุดท้าย: แยกหน้าที่ · ส่งกลับ → แก้ (ยอดเท่าเดิม) → กลับมาผู้ตรวจโดยตรง → ยืนยัน = ปิดงาน + ลงบัญชี
s, r = post(STF, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True); ok('Staff ยืนยันขั้นสุดท้ายไม่ได้', s == 403, r)
s, r = post(OWN, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True); ok('Owner ที่อนุมัติเคลียร์แล้ว เป็นผู้ตรวจสุดท้ายรายการเดียวกันไม่ได้', s == 403, r)
s, r = flow(VER, sd); ok('ผู้ตรวจสุดท้ายเปิดรายละเอียด + ไฟล์ทั้งขอเบิกและเคลียร์', s == 200 and r['data']['actions']['verify'] and {f['stage'] for f in r['data']['files']} == {'request', 'clearance'}, r.get('data', {}).get('actions'))
fid = [f for f in r['data']['files'] if f['stage'] == 'request'][0]['id']
s, r = get(VER, 'expense-clearance-file-url', file_id=fid); ok('ผู้ตรวจเปิดไฟล์ใบเสนอราคาผ่านลิงก์ชั่วคราว', s == 200 and r['data']['url'].startswith('http://127.0.0.1:8760/'), r)
s, r = post(VER, 'expense-clearance.verifier-return', clearance_id=cid, note='สลิปไม่ชัด'); ok('ผู้ตรวจสุดท้ายส่งกลับ', s == 200 and r['data']['returned_stage'] == 'verifier', r)
upload_to(STF, {'action': 'expense-clearance.file.upload', 'clearance_id': cid, 'category': 'payment_evidence'}, filename='slip2.png', mime='image/png', data=b'\x89PNG test')
s, r = post(STF, 'expense-clearance.submit', document_id=sd, actual_paid_amount=1200, actual_expense_amount=1000, payment_date=FD, payment_method='cash')
ok('แก้หลักฐาน (ยอดเท่าเดิม) → กลับไปผู้ตรวจสุดท้ายโดยตรง', s == 200 and r['data']['status'] == 'owner_approved' and r['data']['next_step'] == 'final_verification', r)
s, r = post(VER, 'expense-clearance.verify', clearance_id=cid); ok('ต้องติ๊กยืนยันเอกสารครบ', s == 400, r)
s, r = post(VER, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True); ok('ผู้ตรวจยืนยัน → ปิดงาน + ลงบัญชี', s == 200 and r['data']['accounting_posted'] and r['data']['refund'] == 200, r)
ok('สมุดรายวัน: Dr วัสดุ 1,000 + รับเงินคืน (เงินสด) 200 / Cr เงินสด 1,200', jl_clear(sd) == '1000:200.00/1200.00 5200:1000.00/0.00', jl_clear(sd))
s, r = flow(OWN, sd); ok('สถานะ: ปิดงานแล้ว + เลขสมุดรายวัน', r['data']['item']['stage'] == 'closed' and r['data']['clearance']['journal_number'] and r['data']['document']['status'] == 'posted', r['data']['item'])
s, r = post(VER, 'expense-clearance.verify', clearance_id=cid, confirm_complete=True); ok('ปิดงานซ้ำไม่ได้', s == 409, r)
s, r = upload_to(STF, {'action': 'expense-request.file.upload', 'document_id': sd, 'category': 'supporting'}); ok('ปิดงานแล้วแนบไฟล์คำขอเพิ่มไม่ได้', s == 409, r)
# 6) เปลี่ยนยอดหลังผู้ตรวจส่งกลับ → ต้องกลับไป Owner อนุมัติใหม่
s, r = post(STF, 'document.create', idem=k(), document_type='expense', document_date=FD, submit=True, lines=[{'description': 'ค่าขนส่ง', 'quantity': 1, 'unit_price': 300}]); sd2 = r['data']['id']
post(OWN, 'document.approve', document_id=sd2)
s, r, c2 = close_expense(sd2, STF, approver=OWN, date=FD, method='cash', verify=False)
post(VER, 'expense-clearance.verifier-return', clearance_id=c2, note='ยอดไม่ตรงใบเสร็จ')
s, r = post(MGR, 'expense-clearance.submit', document_id=sd2, actual_paid_amount=300, actual_expense_amount=250, payment_date=FD, payment_method='cash')
ok('Manager (สาขาเดียวกัน) แก้ยอดให้ Staff → กลับไปรอ Owner อนุมัติใหม่', s == 200 and r['data']['status'] == 'pending_owner_review', r)
# 7) สิทธิ์ตามสาขา
s, r = post(ACC, 'document.create', idem=k(), document_type='expense', document_date=FD, submit=True, lines=[{'description': 'สาขา B', 'quantity': 1, 'unit_price': 100}]); bd = r['data']['id']
post(APR, 'document.approve', document_id=bd)
s, r = flow(MGR, bd); ok('Manager เปิดคำขอของสาขาอื่นไม่ได้', s == 403, r)
s, r = post(MGR, 'expense-clearance.submit', document_id=bd, submit=False, actual_paid_amount=100, payment_date=FD, payment_method='cash'); ok('Manager เคลียร์คำขอของสาขาอื่นไม่ได้', s == 403, r)
s, r = get(MGR, 'expense-flow', tab='all'); ok('Manager เห็นเฉพาะคำขอในสาขา', s == 200 and bd not in [x['id'] for x in r['data']['items']] and sd in [x['id'] for x in r['data']['items']], len(r['data']['items']))
s, r = get(STF, 'expense-flow', tab='all'); ok('Staff เห็นเฉพาะของตัวเอง', s == 200 and all(x['created_by'] == 'u:U6' for x in r['data']['items']), r)
s, r = get(VER, 'expense-flow', tab='todo'); ok('ผู้ตรวจสุดท้ายเห็นงานรอตรวจ', s == 200 and r['data']['role'] == 'verifier', r)
s, r = get(VER, 'payments'); ok('ผู้ตรวจสุดท้ายเปิดหน้ารายการรับ/จ่ายทั่วไปไม่ได้', s == 403, r)
# 8) เคลียร์บางส่วน + VAT + หัก ณ ที่จ่าย (แบ่งภาษีตามสัดส่วน)
s, r = post(ACC, 'document.create', idem=k(), document_type='bill', document_date=FD, partner_id=vend, vat_rate=7, wht_rate=3, submit=True,
            lines=[{'description': 'ค่าบริการทำความสะอาด', 'quantity': 1, 'unit_price': 10000, 'account_code': '5200'}]); pb = r['data']['id']
post(APR, 'document.approve', document_id=pb)
s, r, _ = close_expense(pb, ACC, date=FD, paid=10400, expense=5200)
ok('เคลียร์ครึ่งเดียว: ฐาน 5,000 VAT 350 หัก 150 + คืน 5,200 เข้าธนาคาร', s == 200 and r['data']['vat'] == 350 and r['data']['wht'] == 150 and r['data']['refund'] == 5200 and jl_clear(pb) == '1010:5200.00/10400.00 1150:350.00/0.00 2120:0.00/150.00 5200:5000.00/0.00', (r, jl_clear(pb)))
ok('ภาษีซื้อ/หัก ณ ที่จ่ายเข้ารายงานภาษีตามยอดจริง', psql(f"select string_agg(tax_type||':'||tax_base||'/'||tax_amount, ' ' order by tax_type) from finance.tax_transactions where document_id='{pb}'") == 'vat_input:5000.00/350.00 wht:5000.00/150.00')
s, r = post(OWN, 'document.reverse', document_id=pb, reason='ทดสอบกลับรายการ'); ok('กลับรายการเอกสารที่ปิดเคลียร์แล้วได้ (สมุดรายวันกลับด้าน)', s == 200 and r['data']['reversal_journal'], r)
s, r = get(OWN, 'trial-balance', **{'from': '2026-11-01', 'to': '2026-12-31'}); ok('งบทดลองยังสมดุลหลังเคลียร์', r['data']['totals']['balanced'], r['data']['totals'])

print('— ล้างข้อมูลทดสอบ / เริ่มใช้งานจริง —')
s, r = post(OWN, 'company.purge-test-data', confirm='ผิด'); ok('ล้างข้อมูลต้องพิมพ์ยืนยัน', s == 400, r)
s, r = post(APR, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('ผู้อนุมัติล้างข้อมูลไม่ได้', s == 403, r)
s, r = post(OWN, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('ล้างข้อมูลทดสอบ (เก็บการตั้งค่า)', s == 200 and r['data']['deleted']['documents'] > 5, r)
ok('หลังล้าง: เอกสาร 0, ผังบัญชี 29, คู่ค้า 3, รอบบัญชีเปิดทั้งหมด, ประวัติ = เฉพาะการล้าง',
   psql("select count(*) from finance.documents")+'|'+psql("select count(*) from finance.chart_of_accounts")+'|'+psql("select count(*) from finance.partners")+'|'+psql("select count(*) from finance.accounting_periods where status<>'open'")+'|'+psql("select string_agg(action,',') from finance.audit_events") == '0|29|3|0|purge_test_data',
   psql("select string_agg(action,',') from finance.audit_events"))
ok('หลังล้าง: ลบรายการเคลียร์ ประวัติ final verification และ metadata ไฟล์แนบแล้ว',
   psql("select count(*) from finance.payment_verifications") == '0' and psql("select count(*) from finance.document_files") == '0' and psql("select count(*) from finance.expense_clearances") == '0')
s, r = post(OWN, 'company.go-live', confirm='เริ่มใช้งานจริง'); ok('ชื่อบริษัทยังเป็นชื่อทดสอบ → เริ่มใช้งานจริงไม่ได้', s == 409, r)
post(OWN, 'company.update', legal_name='บริษัท คาเฟ่ ทดลอง จำกัด'.replace('ทดลอง', 'ตัวอย่าง'), tax_id='0105566000001', vat_registered=True)
s, r = post(OWN, 'company.go-live', confirm='เริ่มใช้งานจริง'); ok('เริ่มใช้งานจริง', s == 200 and r['data']['environment'] == 'production', r)
s, r = get(OWN, 'session'); ok('Session แสดง production', r['data']['company']['environment'] == 'production', r)
s, r = post(OWN, 'company.purge-test-data', confirm='ล้างข้อมูลทดสอบ'); ok('หลังใช้งานจริง ล้างข้อมูลไม่ได้', s == 409, r)
ok('DB: ล้างข้อมูลบริษัทจริงไม่ได้แม้เรียกฟังก์ชันตรง', 'UAT' in subprocess.run(['psql', '-h', '127.0.0.1', '-p', '5544', '-U', 'postgres', '-d', 'fin', '-c', "select finance.purge_company_transactions((select id from finance.companies limit 1))"], capture_output=True, text=True).stderr)
s, r = get(ACC, 'session'); ok('ผู้ใช้เดิมยังเข้าได้หลังเริ่มใช้งานจริง', s == 200, r)
print(f'\nผ่าน {sum(R)} / {len(R)}')
