# ทดสอบหน้า HR › Positions + ซิงก์สิทธิ์ตามตำแหน่ง (PC / iPad / iPhone) — mock หลังร้าน :8798 + hr-position-api (Deno) :8000
import json, urllib.request, subprocess
from playwright.sync_api import sync_playwright
BASE='http://localhost:8767/'; SUPA='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/'
R=[]; ERR=[]
def ok(n,c,x=''): R.append(bool(c)); print(('✓ ' if c else '✗ ')+n, '' if c else x)
def st(): return json.loads(urllib.request.urlopen('http://127.0.0.1:8798/state').read())
def q(s): return subprocess.run(['psql','-h','127.0.0.1','-p','5544','-U','postgres','-d','hrt','-Atc',s],capture_output=True,text=True).stdout.strip()
def hr_route(r):
    if r.request.method=='OPTIONS': return r.fulfill(status=200, headers={'access-control-allow-origin':'http://localhost:8767','access-control-allow-headers':'content-type,x-cms-session','access-control-allow-methods':'GET,POST,OPTIONS'})
    r.fulfill(response=r.fetch(url='http://localhost:8000/'))
def bo_route(r): r.fulfill(response=r.fetch(url=r.request.url.replace(SUPA+'backoffice','http://127.0.0.1:8798/functions/v1/backoffice')))
def ctx(p,b,tok,dev=None,path='index.html#hr/positions'):
    c=b.new_context(**(p.devices[dev] if dev else {'viewport':{'width':1366,'height':900}}), service_workers='block')
    c.route(SUPA+'hr-position-api**',hr_route); c.route(SUPA+'backoffice**',bo_route)
    c.route('**/fonts.g*/**',lambda r:r.abort()); c.route('**/static.line-scdn.net/**',lambda r:r.abort())
    c.route(SUPA+'finance-api**',lambda r:r.fulfill(status=403,body='{"ok":false}',headers={'access-control-allow-origin':'*'}))
    pg=c.new_page(); pg.on('pageerror',lambda e:ERR.append(str(e)[:200]))
    pg.goto(BASE+'css/app.css'); pg.evaluate(f"sessionStorage.setItem('amz.tok','{tok}')"); pg.goto(BASE+path)
    return c,pg
def wait_list(pg): pg.wait_for_selector('#view .row[data-a^="position:"]',timeout=20000)
def edit(pg,name,role=None,perms=None,fin=None):
    pg.click(f'#view .row[data-a^="position:"]:has-text("{name}")'); pg.wait_for_selector('.sheet [data-k="t_role"]')
    if role is not None: pg.select_option('.sheet [data-k="t_role"]',role)
    if fin is not None: pg.select_option('.sheet [data-k="t_fin"]',fin)
    if perms is not None:
        for cb in pg.locator('.sheet [data-k="t_perms"] input').all():
            want=cb.get_attribute('value') in perms
            if cb.is_checked()!=want: cb.locator('xpath=..').click()
    pg.click('.sheet [data-act="save"]'); pg.wait_for_selector('.sheet',state='detached',timeout=15000)
urllib.request.urlopen('http://127.0.0.1:8798/reset')
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- Owner · PC ----------
    c,pg=ctx(p,b,'tok_owner'); wait_list(pg)
    ok('PC: หน้า ตำแหน่งงาน แสดงรายการจากฐานข้อมูล', pg.locator('#view .row[data-a^="position:"]').count()>=3)
    ok('PC: หัวข้อ/ปุ่มภาษาไทย', '+ เพิ่มตำแหน่ง' in pg.inner_text('#view') and 'Create Position' not in pg.inner_text('#view'))
    ok('PC: ตำแหน่งที่ยังไม่ตั้งสิทธิ์ขึ้นป้าย', 'ยังไม่ตั้งสิทธิ์' in pg.inner_text('#view'))
    edit(pg,'บาริสต้า',role='staff',perms=['time','orders'],fin='staff'); pg.wait_for_timeout(2500)
    u11=[u for u in st()['db']['users'] if u['id']=='U11'][0]
    ok('แก้สิทธิ์ตำแหน่ง บาริสต้า → บัญชีของพนักงานในตำแหน่งปรับตาม', sorted(u11['perms'].split(','))==['orders','time'] and u11['role']=='staff', u11)
    ok('Finance: U11 ได้บทบาท staff จากตำแหน่ง', q("select role_code||'|'||granted_by from finance.user_roles where cms_actor_ref='u:U11'")=='staff|position:BARISTA')
    ok('รายการตำแหน่งแสดง Role/สิทธิ์/Finance/จำนวนคน', 'Finance: Staff' in pg.inner_text('#view') and '2 คน' in pg.inner_text('#view'))
    edit(pg,'ผู้จัดการร้าน',role='manager',perms=['time','stock','orders','catalog'],fin='manager'); pg.wait_for_timeout(2500)
    u10=[u for u in st()['db']['users'] if u['id']=='U10'][0]
    ok('ผู้จัดการร้าน → U10 ได้ stock/orders/catalog/time', sorted(u10['perms'].split(','))==['catalog','orders','stock','time'], u10)
    ok('ทุกบัญชีตรงตามตำแหน่ง → ขึ้นป้ายสถานะ', 'ตรงตามตำแหน่งแล้ว' in pg.inner_text('#view'))
    pg.evaluate("location.hash='#users'"); pg.wait_for_timeout(800)
    ok('หน้า Users แสดงตำแหน่งของบัญชี', 'ผู้จัดการร้าน' in pg.inner_text('#view') and 'บาริสต้า' in pg.inner_text('#view'))
    pg.click('#view .row[data-a="user:U11"]'); pg.wait_for_selector('.sheet')
    ok('ฟอร์มผู้ใช้บอกว่าสิทธิ์มาจากตำแหน่ง', 'มาจากตำแหน่ง' in pg.inner_text('.sheet'))
    pg.click('.sheet [data-act="cancel"]')
    pg.screenshot(path='/tmp/hrt/pc_users.png')
    pg.evaluate("location.hash='#hr/positions'"); wait_list(pg); pg.screenshot(path='/tmp/hrt/pc_positions.png', full_page=True)
    c.close()
    # ---------- HR · iPhone ----------
    c,pg=ctx(p,b,'tok_hr','iPhone 13'); wait_list(pg)
    ok('มือถือ HR: เปิดหน้า ตำแหน่งงาน ได้', pg.locator('#view .row[data-a^="position:"]').count()>=3)
    over=pg.evaluate("document.documentElement.scrollWidth-innerWidth"); ok('มือถือ: ไม่ล้นจอ', over<=1, over)
    pg.screenshot(path='/tmp/hrt/m_positions.png', full_page=True)
    pg.click('#view .row[data-a^="position:"]:has-text("บาริสต้า")'); pg.wait_for_selector('.sheet [data-k="t_perms"]')
    opts=pg.eval_on_selector_all('.sheet [data-k="t_perms"] input','els=>els.map(e=>e.value)')
    ok('HR เลือกได้เฉพาะสิทธิ์ที่ตัวเองมี + ของเดิม', set(opts)=={'hr','payroll','time','orders'}, opts)
    fins=pg.eval_on_selector_all('.sheet [data-k="t_fin"] option','els=>els.map(e=>e.value)')
    ok('HR เลือกบทบาท Finance ระดับสูงไม่ได้', 'approver' not in fins and 'verifier' not in fins, fins)
    pg.screenshot(path='/tmp/hrt/m_form.png', full_page=True)
    pg.click('.sheet [data-act="cancel"]')
    # HR ย้ายพนักงาน E3 ไปตำแหน่ง ผู้จัดการร้าน → Role เปลี่ยนตาม
    pg.evaluate("location.hash='#hr/emp'"); pg.wait_for_selector('#view .row[data-a="emp:E3"]',timeout=15000)
    pg.click('#view .row[data-a="emp:E3"]'); pg.wait_for_selector('.sheet [data-k="position"]')
    ok('ฟอร์มพนักงานบอกว่า Role ตามตำแหน่ง', 'เป็นไปตามตำแหน่ง' in pg.inner_text('.sheet'))
    order=pg.eval_on_selector_all('.sheet [data-k]','els=>els.map(e=>e.dataset.k)')
    ok('ฟอร์มพนักงาน: ช่องตำแหน่งอยู่ก่อน Role', order.index('position') < order.index('role'), order)
    ok('ตำแหน่ง บาริสต้า → Role ล็อกเป็น Staff', pg.eval_on_selector('.sheet [data-k="role"]','e=>e.disabled && e.value') == 'staff')
    pg.select_option('.sheet [data-k="position"]','ผู้จัดการร้าน'); pg.wait_for_timeout(100)
    ok('เปลี่ยนตำแหน่งเป็น ผู้จัดการร้าน → Role เปลี่ยนเป็น Manager ทันที', pg.eval_on_selector('.sheet [data-k="role"]','e=>e.value')=='manager')
    pg.click('.sheet [data-act="save"]'); pg.wait_for_selector('.sheet',state='detached',timeout=15000); pg.wait_for_timeout(500)
    e3=[e for e in st()['db']['employees'] if e['id']=='E3'][0]
    ok('HR เปลี่ยนตำแหน่ง → Role พนักงานเป็น Manager ตามตำแหน่ง', e3['role']=='manager' and e3.get('positionCode')=='MANAGER', e3)
    # เปลี่ยนตำแหน่งของคนที่มีรหัสตำแหน่งเดิมแล้ว ต้องไม่เด้งกลับ (บาริสต้า → ผู้จัดการร้าน)
    for target in ('บาริสต้า', 'ผู้จัดการร้าน'):
        pg.click('#view .row[data-a="emp:E2"]'); pg.wait_for_selector('.sheet [data-k="position"]')
        pg.select_option('.sheet [data-k="position"]', target); pg.click('.sheet [data-act="save"]'); pg.wait_for_selector('.sheet', state='detached', timeout=15000); pg.wait_for_timeout(400)
    e2=[e for e in st()['db']['employees'] if e['id']=='E2'][0]
    ok('เปลี่ยนตำแหน่ง บาริสต้า → ผู้จัดการร้าน แล้วไม่เด้งกลับ', e2['position']=='ผู้จัดการร้าน' and e2['positionCode']=='MANAGER', e2)
    pg.click('#view [data-a="newEmp"]'); pg.wait_for_selector('.sheet [data-k="position"]')
    pg.select_option('.sheet [data-k="position"]','Final Verifier'); pg.wait_for_timeout(100)
    ok('ตำแหน่งที่ยังไม่ตั้ง Role → เลือก Role เองได้', not pg.eval_on_selector('.sheet [data-k="role"]','e=>e.disabled'))
    pg.screenshot(path='/tmp/hrt/m_newemp.png')
    pg.click('.sheet [data-act="cancel"]')
    c.close()
    # ---------- iPad ----------
    c,pg=ctx(p,b,'tok_owner','iPad (gen 7)'); wait_list(pg)
    over=pg.evaluate("document.documentElement.scrollWidth-innerWidth"); ok('iPad: หน้า ตำแหน่งงาน ไม่ล้นจอ', over<=1, over)
    pg.screenshot(path='/tmp/hrt/ipad_positions.png'); c.close()
    # ---------- Manager ที่มีสิทธิ์ HR ----------
    c,pg=ctx(p,b,'tok_mgrhr'); wait_list(pg)
    ok('Manager+HR: โหลดตำแหน่งได้ (เดิม 403)', 'เชื่อมต่อข้อมูลตำแหน่งไม่สำเร็จ' not in pg.inner_text('#view')); c.close()
    ok('ไม่มี error ในหน้าเว็บ', not ERR, ERR)
print(f'ผ่าน {sum(R)} / {len(R)}')
