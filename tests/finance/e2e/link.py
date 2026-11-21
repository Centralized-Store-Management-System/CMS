exec(open('/tmp/fe2e/ui.py').read().split('with sync_playwright() as p:')[0])
calls = {'n': 0}
def route2(r):
    calls['n'] += 1; route(r)
with sync_playwright() as p:
    b = p.chromium.launch()
    for tok, want in [('tok_owner_123', True), ('tok_nobody_12', False)]:
        c = b.new_context(); c.route(REMOTE + '**', route2); pg = c.new_page()
        pg.goto(BASE + 'link-test.html'); pg.evaluate(f"S.token='{tok}'; renderNav()"); pg.wait_for_timeout(1500)
        has = pg.locator('#nav [data-fin]').count() == 1
        menu = 'Finance' in pg.evaluate('viewMenu()')
        n0 = calls['n']; pg.evaluate('renderNav();renderNav()'); pg.wait_for_timeout(500)
        ok(f'{tok}: เมนู Finance ใน nav = {want}', has == want); ok(f'{tok}: tile ในหน้า Menu = {want}', menu == want); ok(f'{tok}: ถามครั้งเดียวต่อ session', calls['n'] == n0)
    print('errors', ERR)
print(f'ผ่าน {sum(R)} / {len(R)}')
