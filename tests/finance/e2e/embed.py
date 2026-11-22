# ทดสอบ Finance ในหน้าหลังร้านจริง (index.html) — เมนูหลัก + เมนูย่อย + แสดงในพื้นที่เดียวกับเมนูอื่น
# ต้องเปิด up.sh (Postgres + Finance API + mock CMS) และเว็บ python3 -m http.server 8767 ที่โฟลเดอร์ repo
import re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8767/'
FAPI = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api'
BO = 'https://ytxbnqosenolojifeikf.supabase.co/functions/v1/backoffice'
R = []; ERR = []
def ok(n, c, x=''):
    R.append(bool(c)); print(('✓ ' if c else '✗ ') + n, '' if c else x)

def fin_route(r):
    if r.request.method == 'OPTIONS':
        return r.fulfill(status=200, headers={'access-control-allow-origin': 'http://localhost:8767', 'access-control-allow-headers': 'content-type, x-cms-session, idempotency-key, x-request-id', 'access-control-allow-methods': 'GET, POST, OPTIONS'})
    r.fulfill(response=r.fetch(url=r.request.url.replace(FAPI, 'http://localhost:8000/')))
def bo_route(r):
    r.fulfill(response=r.fetch(url=r.request.url.replace(BO, 'http://127.0.0.1:8799/')))

def open_ctx(p, b, tok, mobile=False, path='index.html'):
    c = b.new_context(**(p.devices['iPhone 13'] if mobile else {'viewport': {'width': 1366, 'height': 900}}), service_workers='block')
    c.route(FAPI + '**', fin_route); c.route(BO + '**', bo_route)
    c.route('**/fonts.g*/**', lambda r: r.abort()); c.route('**/static.line-scdn.net/**', lambda r: r.abort())
    pg = c.new_page()
    pg.on('pageerror', lambda e: ERR.append(str(e)[:200]))
    pg.goto(BASE + 'css/app.css'); pg.evaluate(f"sessionStorage.setItem('amz.tok','{tok}');sessionStorage.setItem('amz.it.tok','{tok}')")
    pg.goto(BASE + path)
    return c, pg

def sub(pg, key):   # เมนูย่อยอยู่ในกลุ่มที่พับได้ → เปิดกลุ่มก่อนกด
    pg.evaluate(f"(()=>{{const a=document.querySelector('#finSubnav a[data-fin-page=\"{key}\"]'); const d=a&&a.closest('details'); if(d) d.open=true;}})()")
    pg.click(f'#finSubnav a[data-fin-page="{key}"]')

def wait_fin(pg, head=None):
    pg.wait_for_selector('#fmContent .fm-page-head', timeout=20000)
    pg.wait_for_function("!document.querySelector('#fmContent .fm-loading')", timeout=20000)
    if head: pg.wait_for_function(f"(document.querySelector('#fmContent .fm-page-head h1')||{{}}).textContent?.includes('{head}')", timeout=20000)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- Owner · PC ----------
    c, pg = open_ctx(p, b, 'tok_owner_123')
    pg.wait_for_selector('#nav a[href="#fin"]', timeout=20000)
    nav_font = pg.evaluate("getComputedStyle(document.querySelector('#nav a')).fontSize")
    ok('PC: เมนูหลัก Finance & Accounting อยู่ในแถบซ้าย (กลุ่ม Finance)', pg.locator('#nav h4', has_text='Finance').count() == 1 and 'Finance' in pg.inner_text('#nav a[href="#fin"]'))
    ok('PC: ไม่มีลิงก์ไปหน้าแยก finance.html', pg.locator('a[href*="finance.html"]').count() == 0)
    ok('PC: ยังไม่เปิด Finance → ยังไม่มีเมนูย่อย', pg.locator('#finSubnav').count() == 0)
    pg.click('#nav a[href="#fin"]'); wait_fin(pg, 'ภาพรวม')
    ok('กดเมนูหลัก → แสดง Finance ในพื้นที่หลัก (#view) หน้าเดียวกับเมนูอื่น', pg.locator('main#view .fin-embed #fmContent').count() == 1 and pg.locator('#nav').is_visible())
    ok('หัวหน้าเป็นแบบเดียวกับเมนูอื่น: Finance & Accounting', pg.inner_text('#tb-title') == 'Finance & Accounting' and pg.locator('.mhead[data-header="fin"]').count() == 1)
    subs = pg.locator('#finSubnav a').count()
    ok(f'เมนูย่อยลงมาใต้เมนูหลัก ({subs} รายการ)', pg.locator('#nav a[href="#fin"] + #finSubnav').count() == 1 and subs >= 18)
    ok('เมนูย่อย "ภาพรวม" ถูกเลือก', pg.locator('#finSubnav a[aria-current="page"]').inner_text().startswith('ภาพรวม'))
    pg.evaluate("document.querySelector('#nav').dataset.mark='1'; document.querySelector('.mhead[data-header=\"fin\"]').dataset.mark='1'; document.querySelectorAll('#finSubnav details').forEach(d=>d.open=false); const t=[...document.querySelectorAll('#finSubnav details')].find(d=>d.textContent.includes('ภาษี')); if(t) t.open=true")
    sub(pg, 'income'); wait_fin(pg, 'รายรับ')
    ok('กดเมนูย่อย → ไม่วาดแถบเมนู/หัวหน้าใหม่ทั้งหน้า (ไม่ refresh)', pg.evaluate("document.querySelector('#nav').dataset.mark==='1' && document.querySelector('.mhead[data-header=\"fin\"]').dataset.mark==='1'"))
    ok('กดเมนูย่อย → กลุ่มเมนูที่กางไว้ไม่หุบเอง', pg.evaluate("[...document.querySelectorAll('#finSubnav details[open] > summary')].some(s=>s.textContent.includes('ภาษี'))"))
    ok('กดเมนูย่อย รายรับ → #fin/income แสดงในหน้าเดิม', pg.evaluate('location.hash') == '#fin/income' and pg.locator('#finSubnav a[aria-current="page"]').inner_text().startswith('รายรับ'))
    ok('คำอธิบายหัวหน้าบอกหน้าปัจจุบัน + โหมด', 'รายรับ' in pg.inner_text('.mhead h1 small') and ('UAT' in pg.inner_text('.mhead h1 small') or 'ใช้งานจริง' in pg.inner_text('.mhead h1 small')))
    # เปลี่ยนหน้า: หน้าเดิมยังอยู่ระหว่างโหลด (ไม่กระพริบเป็นหน้าโหลดเปล่า)
    pg.route(FAPI + '**', lambda r: (pg.wait_for_timeout(400), fin_route(r)) if 'action=documents' in r.request.url else fin_route(r))
    sub(pg, 'expense'); pg.wait_for_timeout(120)
    ok('กดเมนูย่อย → ระหว่างโหลด หน้าเดิมยังแสดงอยู่ (จางลง ไม่ขึ้นหน้าโหลดเปล่า)', pg.evaluate("(()=>{const c=document.querySelector('#fmContent');const v=c.querySelector(':scope>.fm-host:not([hidden])');return c.classList.contains('fm-busy')&&!!v&&v.textContent.includes('รายรับ')})()"))
    wait_fin(pg, 'รายจ่าย'); pg.unroute(FAPI + '**'); pg.route(FAPI + '**', fin_route)
    ok('โหลดเสร็จ → แสดงหน้าใหม่ กล่องเดียว ไม่จาง', pg.evaluate("(()=>{const c=document.querySelector('#fmContent');return c.children.length===1&&!c.classList.contains('fm-busy')})()"))
    # ตัวดักคลิกของหน้าเก่าต้องไม่ซ้อน: เปิดหน้าเบิก–เคลียร์ 2 รอบ แล้วกดแท็บ → เรียก API ครั้งเดียว
    sub(pg, 'expflow'); wait_fin(pg, 'เบิก–เคลียร์'); sub(pg, 'income'); wait_fin(pg, 'รายรับ'); sub(pg, 'expflow'); wait_fin(pg, 'เบิก–เคลียร์')
    pg.wait_for_timeout(500); calls = []
    pg.on('request', lambda r: calls.append(1) if 'action=expense-flow' in r.url and 'tab=all' in r.url else None)
    pg.locator('#fmContent [data-tab="all"]').first.click(); pg.wait_for_timeout(800)
    ok('เข้าหน้าซ้ำแล้วกดแท็บ → ทำงานครั้งเดียว (ตัวดักคลิกไม่ซ้อน)', len(calls) == 1, len(calls))
    sub(pg, 'income'); wait_fin(pg, 'รายรับ')
    pg.click('#nav a[href="#fin"]'); pg.wait_for_timeout(200)
    ok('กดเมนูหลักซ้ำ → ย่อเมนูย่อย (ยังอยู่หน้าเดิม)', pg.locator('#finSubnav').count() == 0 and pg.evaluate('location.hash') == '#fin/income')
    pg.click('#nav a[href="#fin"]'); pg.wait_for_timeout(200)
    ok('กดอีกครั้ง → ขยายเมนูย่อย', pg.locator('#finSubnav').count() == 1)
    # ลิงก์/ปุ่มภายในหน้า Finance ต้องอยู่ใต้ #fin/
    sub(pg, 'dashboard'); wait_fin(pg, 'ภาพรวม')
    btn = pg.locator('#fmContent [data-go="#income/new"]')
    if btn.count():
        btn.first.click(); pg.wait_for_selector('#fmContent form, #fmContent .fm-form-grid', timeout=15000)
        ok('ปุ่มในหน้า (data-go) → #fin/income/new', pg.evaluate('location.hash') == '#fin/income/new')
        inp = pg.locator('#fmContent input[type=text], #fmContent input:not([type])').first
        inp.fill('ทดสอบค้างไว้'); pg.evaluate('document.activeElement.blur(); App.render()'); pg.wait_for_timeout(300)
        ok('หน้าหลังร้านวาดใหม่ (ข้อมูลอัปเดต) → ฟอร์มที่กรอกไม่หาย', pg.locator('#fmContent input[type=text], #fmContent input:not([type])').first.input_value() == 'ทดสอบค้างไว้')
    else:
        ok('ปุ่มในหน้า (data-go) → #fin/income/new', False, 'ไม่พบปุ่ม')
    pg.evaluate("location.hash='#fin/accounts'"); wait_fin(pg, 'ผังบัญชี')
    a = pg.locator('#fmContent a[href^="#ledger/"], #fmContent a[href^="#journal/"]')
    ok('เปิดด้วยที่อยู่ #fin/accounts ได้', True)
    # หน้าต่าง + แจ้งเตือน ใช้ CSS ของ Finance
    pg.evaluate("FIN.modal('ทดสอบ','<p>x</p>')")
    st = pg.evaluate("(()=>{const o=document.querySelector('#finLayer .fm-overlay');return o&&getComputedStyle(o).position+'|'+getComputedStyle(o.querySelector('.fm-dialog')).borderRadius})()")
    ok('หน้าต่าง Finance แสดงถูกแบบ (fixed, มุมโค้ง)', st and st.startswith('fixed|') and st != 'fixed|0px', st)
    pg.click('#finLayer .fm-x')
    ok('CSS ของ Finance ไม่กระทบเมนู CMS', pg.evaluate("getComputedStyle(document.querySelector('#nav a')).fontSize") == nav_font and pg.evaluate("getComputedStyle(document.body).overflow") != 'hidden')
    # ออกไปเมนูอื่น แล้วกลับ
    other = pg.evaluate("[...document.querySelectorAll('#nav > a')].map(a=>a.getAttribute('href')).find(h=>h&&h.startsWith('#')&&h!=='#fin')")
    pg.evaluate(f"location.hash='{other}'"); pg.wait_for_timeout(600)
    ok(f'ไปเมนูอื่น ({other}) → Finance ปิด เมนูย่อยหุบ', pg.locator('main#view #fmContent').count() == 0 and pg.locator('#finSubnav').count() == 0)
    pg.evaluate("location.hash='#fin/trial-balance'"); wait_fin(pg, 'งบทดลอง')
    ok('กลับมา #fin/trial-balance ได้', pg.locator('#finSubnav a[aria-current="page"]').inner_text().startswith('งบทดลอง'))
    ok('หน้า All Menus มี Finance', pg.evaluate("viewMenu().includes('#fin')"))
    # หน้าแยกเดิม → พามาหน้าหลังร้าน
    pg.goto(BASE + 'modules/finance/finance.html#payments'); pg.wait_for_url('**/index.html#fin/payments', timeout=10000); wait_fin(pg, 'รับ')
    ok('เปิด finance.html เดิม → พามา index.html#fin/payments', True)
    c.close()
    # ---------- Owner · iPhone ----------
    c, pg = open_ctx(p, b, 'tok_owner_123', mobile=True, path='index.html#fin')
    wait_fin(pg, 'ภาพรวม')
    ok('มือถือ: เปิด #fin แสดง Finance ในหน้าหลังร้าน', pg.locator('main#view #fmContent').count() == 1)
    ok('มือถือ: มีเมนู Finance บนสุดของหน้า (ย่ออยู่)', pg.locator('.fin-mnav').is_visible() and not pg.locator('.fin-mnav a').first.is_visible())
    pg.click('.fin-mnav summary'); pg.wait_for_timeout(150)
    ok('มือถือ: แตะ "เมนู Finance" → เมนูย่อยลงมา', pg.locator('.fin-mnav a[data-fin-page="expflow"]').is_visible())
    arrow = "getComputedStyle(document.querySelector('.fin-mnav-group > summary'), '::after').transform"
    shut = pg.evaluate(arrow)
    pg.click('.fin-mnav-group > summary'); pg.wait_for_timeout(150)
    ok('มือถือ: กดกลุ่มเมนู → รายการในกลุ่มลงมา', pg.locator('.fin-mnav-group[open] .fin-mnav-items a').first.is_visible())
    ok('มือถือ: ลูกศรกลุ่มเปลี่ยนทิศเมื่อกาง/หุบ', pg.evaluate(arrow) != shut, (shut, pg.evaluate(arrow)))
    pg.evaluate("App.render()"); pg.wait_for_timeout(200)
    ok('มือถือ: หน้าวาดใหม่ (ข้อมูลเปลี่ยน) เมนู/กลุ่มที่กางไว้ไม่หุบเอง', pg.locator('.fin-mnav-group[open] .fin-mnav-items a').first.is_visible())
    pg.click('.fin-mnav a[data-fin-page="expflow"]'); wait_fin(pg, 'เบิก–เคลียร์')
    ok('มือถือ: เลือกเมนูย่อย → เปิดหน้า แล้วเมนูหุบ', pg.evaluate('location.hash') == '#fin/expflow' and not pg.locator('.fin-mnav a').first.is_visible())
    over = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
    ok('มือถือ: ไม่ล้นจอ', over <= 1, over)
    ok('มือถือ: แถบล่างยังอยู่ (Menu)', pg.locator('#bottom a[href="#menu"]').is_visible())
    c.close()
    # ---------- ไม่มีสิทธิ์ Finance ----------
    c, pg = open_ctx(p, b, 'tok_nobody_12')
    pg.wait_for_selector('#nav', timeout=20000); pg.wait_for_timeout(1500)
    ok('ผู้ไม่มีสิทธิ์: ไม่เห็นเมนู Finance', pg.locator('#nav a[href="#fin"]').count() == 0)
    pg.evaluate("location.hash='#fin/income'"); pg.wait_for_timeout(600)
    ok('ผู้ไม่มีสิทธิ์: พิมพ์ #fin เอง → ไม่เปิด Finance', pg.locator('#fmContent').count() == 0)
    c.close()
    # ---------- แอป Owner หน้าแรก ----------
    c, pg = open_ctx(p, b, 'tok_owner_123', path='owner.html')
    pg.evaluate("document.body.insertAdjacentHTML('beforeend','<div class=\"oc-land-menu\" id=t><a href=\"index.html\">a</a><a data-land=\"it\">b</a><a href=\"modules/finance/finance.html\">Finance & Accounting</a></div>')")
    pg.wait_for_timeout(300)
    ok('แอป Owner หน้าแรก: เหลือ 2 ปุ่ม (ตัด Finance ออก)', pg.locator('#t > *').count() == 2 and 'Finance' not in pg.inner_text('#t'))
    c.close()
    print('errors', [e for e in ERR])
print(f'ผ่าน {sum(R)} / {len(R)}')
