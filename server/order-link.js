// เชื่อมผู้ใช้หลังร้าน (CMS) → ระบบออเดอร์ (public.staff + Supabase Auth) และเข้าระบบออเดอร์อัตโนมัติ (SSO)
// - syncAll(roster): ทำให้ public.staff ตรงกับรายชื่อจาก orderRoster_() (54_OrderLink.gs + 64_OrderPosition.gs ส่งตำแหน่งมาด้วย) — เพิ่ม / แก้ Role-สาขา / ปิด
// - open(user, page): สร้างลิงก์เข้าระบบครั้งเดียว (magic link token_hash) → หน้า Line-Order ยืนยันแล้วเข้าระบบเลย
// บัญชีที่สร้างใหม่ใช้อีเมลภายใน <ref>@cms.cafe-amazon.local (ไม่ส่งอีเมล ไม่มีรหัสผ่าน เข้าได้ผ่านหลังร้านเท่านั้น)
const PORTAL = 'https://cafe-order-web-admin-portal.github.io/Line-Order/';
const BAN = '876000h';

export function orderLink({ sql, supabaseUrl, serviceKey, portal = PORTAL }) {
  const H = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json' };
  async function admin(method, path, body) {
    const r = await fetch(supabaseUrl + '/auth/v1/admin/' + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (_) { /* */ }
    if (!r.ok) throw new Error('auth ' + path.split('/')[0] + ' ' + r.status + ' ' + String(j.msg || j.message || j.error_description || t).slice(0, 160));
    return j;
  }
  const emailOf = ref => 'cms-' + ref.replace(/^u:/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '') + '@cms.cafe-amazon.local';
  const branches = () => sql`select id, branch_code, cms_code, is_active from public.branches order by is_active desc, branch_code`;
  function branchFor(B, code) {
    const hit = code && B.find(b => String(b.cms_code || '').split(/[,\s]+/).includes(code) || b.branch_code === code);
    return (hit || B[0] || {}).id || null;   // ยังไม่ผูกรหัสสาขา → ใช้สาขาแรกที่เปิดอยู่
  }
  const ban = (id, on) => id ? admin('PUT', 'users/' + id, { ban_duration: on ? BAN : 'none' }).catch(e => console.error('ban', e.message)) : null;

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const posCache = new Map();
  /** ตำแหน่งที่ CMS ส่งมา (รหัส → รหัสตำแหน่ง → ชื่อไทย) → hr_positions.id · ไม่พบ = คงค่าเดิมใน staff */
  async function posOf(u, cur) {
    const key = [u.positionId || '', u.positionCode || '', u.position || ''].join('|');
    if (key === '||') return (cur && cur.position_id) || null;
    if (posCache.has(key)) return posCache.get(key) ?? ((cur && cur.position_id) || null);
    let id = null;
    if (UUID.test(String(u.positionId || ''))) {
      const [p] = await sql`select id from public.hr_positions where id = ${u.positionId}`;
      id = p ? p.id : null;
    }
    if (!id && u.positionCode) { const [p] = await sql`select id from public.hr_positions where position_code = ${u.positionCode}`; if (p) id = p.id; }
    if (!id && u.position) { const [p] = await sql`select id from public.hr_positions where name_th = ${u.position}`; if (p) id = p.id; }
    posCache.set(key, id);
    return id ?? ((cur && cur.position_id) || null);
  }

  async function apply(B, u) {
    let [cur] = await sql`select id, auth_user_id, role, branch_id, staff_name, is_active, position_id from public.staff where cms_ref = ${u.ref}`;
    if (!cur && u.ref === 'owner') {   // Owner = บัญชี super_admin เดิมของระบบออเดอร์
      [cur] = await sql`select id, auth_user_id, role, branch_id, staff_name, is_active, position_id from public.staff where cms_ref is null and role = 'super_admin' order by created_at limit 1`;
      if (cur) await sql`update public.staff set cms_ref = 'owner' where id = ${cur.id}`;
    }
    if (!u.active) {
      if (!cur) return 'skip';
      if (cur.is_active) { await sql`update public.staff set is_active = false where id = ${cur.id}`; if (u.ref !== 'owner') await ban(cur.auth_user_id, true); return 'off'; }
      return 'same';
    }
    const branch = u.ref === 'owner' && cur ? cur.branch_id : branchFor(B, u.branch);
    if (!branch) throw new Error('ระบบออเดอร์ยังไม่มีสาขา');
    const pos = await posOf(u, cur);   // ตำแหน่งจาก CMS (CMS เป็นเจ้าของข้อมูล) — หาไม่เจอ = คงค่าเดิมไว้
    if (!cur) {
      const email = emailOf(u.ref);
      let id;
      try { id = (await admin('POST', 'users', { email, email_confirm: true, user_metadata: { name: u.name, cms_ref: u.ref }, app_metadata: { source: 'cms' } })).id; }
      catch (e) { const [x] = await sql`select id from auth.users where email = ${email}`; if (!x) throw e; id = x.id; await ban(id, false); }
      await sql`insert into public.staff (auth_user_id, branch_id, staff_name, role, is_active, cms_ref, position_id) values (${id}, ${branch}, ${u.name}, ${u.role}, true, ${u.ref}, ${pos})`;
      return 'new';
    }
    if (cur.role === u.role && cur.branch_id === branch && cur.staff_name === u.name && cur.is_active && cur.position_id === pos) return 'same';
    await sql`update public.staff set role = ${u.role}, branch_id = ${branch}, staff_name = ${u.name}, is_active = true, position_id = ${pos} where id = ${cur.id}`;
    if (!cur.is_active && u.ref !== 'owner') await ban(cur.auth_user_id, false);
    return 'upd';
  }

  async function syncAll(roster) {
    const B = await branches(), out = {};
    for (const u of roster) { try { out[u.user] = await apply(B, u); } catch (e) { out[u.user] = 'error: ' + e.message; } }
    const refs = roster.map(u => u.ref);
    const gone = await sql`select id, auth_user_id from public.staff where cms_ref is not null and is_active and not (cms_ref = any(${refs}))`;
    for (const g of gone) { await sql`update public.staff set is_active = false where id = ${g.id}`; await ban(g.auth_user_id, true); }
    if (gone.length) out._removed = gone.length;
    return out;
  }

  /** สาขา: ยึดหลังร้าน (Owner & IT) — รหัส ชื่อ เปิด/ปิด ที่อยู่ โทร พิกัด · สาขาใหม่สร้างให้ · สาขาที่ถูกลบในหลังร้าน = ปิดในระบบออเดอร์ */
  async function syncBranches(list) {
    const B = await sql`select id, branch_code, branch_name, cms_code, is_active, address, phone, latitude, longitude from public.branches`, out = {};
    const codesOf = b => String(b.cms_code || '').split(/[,\s]+/).filter(Boolean);
    for (const c of list) {
      try {
        const o = B.find(b => codesOf(b).includes(c.code)) || B.find(b => b.branch_code === c.code);
        const want = { name: c.name, active: !!c.active, address: c.address || (o && o.address) || null, phone: c.phone || (o && o.phone) || null, lat: c.lat ?? (o && o.latitude) ?? null, lng: c.lng ?? (o && o.longitude) ?? null };
        if (!o) {
          await sql`insert into public.branches (branch_code, branch_name, cms_code, is_active, address, phone, latitude, longitude) values (${c.code}, ${want.name}, ${c.code}, ${want.active}, ${want.address}, ${want.phone}, ${want.lat}, ${want.lng})`;
          out[c.code] = 'new'; continue;
        }
        const code = B.some(b => b.id !== o.id && b.branch_code === c.code) ? o.branch_code : c.code;   // รหัสสาขาตามหลังร้าน (ถ้าไม่ชนสาขาอื่น)
        const same = o.branch_code === code && o.branch_name === want.name && o.is_active === want.active && (o.address || null) === want.address && (o.phone || null) === want.phone && Number(o.latitude) === Number(want.lat) && Number(o.longitude) === Number(want.lng) && codesOf(o).includes(c.code);
        if (same) { out[c.code] = 'same'; continue; }
        const cms = codesOf(o).includes(c.code) ? o.cms_code : [...codesOf(o), c.code].join(',');
        await sql`update public.branches set branch_code = ${code}, branch_name = ${want.name}, is_active = ${want.active}, address = ${want.address}, phone = ${want.phone}, latitude = ${want.lat}, longitude = ${want.lng}, cms_code = ${cms} where id = ${o.id}`;
        out[c.code] = o.branch_code !== code ? 'code ' + o.branch_code + '→' + code : o.branch_name !== want.name ? 'rename' : 'upd';
      } catch (e) { out[c.code] = 'error: ' + e.message; }
    }
    const codes = list.map(c => c.code);
    for (const o of B) if (o.is_active && codesOf(o).length && !codesOf(o).some(x => codes.includes(x))) { await sql`update public.branches set is_active = false where id = ${o.id}`; out[o.branch_code] = 'off'; }
    return out;
  }

  async function open(u, page) {
    await apply(await branches(), u);
    const [s] = await sql`select u.email from public.staff s join auth.users u on u.id = s.auth_user_id where s.cms_ref = ${u.ref} and s.is_active`;
    if (!s || !s.email) throw new Error('ยังไม่พบบัญชีในระบบออเดอร์');
    const j = await admin('POST', 'generate_link', { type: 'magiclink', email: s.email });
    const hash = j.hashed_token || (j.properties && j.properties.hashed_token);
    if (!hash) throw new Error('สร้างลิงก์เข้าระบบไม่ได้');
    return portal + (page === 'catalog' ? '' : 'orders.html') + '#sso=' + encodeURIComponent(hash);
  }
  /** ผลตรวจสำหรับระบบ IT (55_OrderIT.gs อ่านจาก props ORDER_IT) — เบา รันทุกนาที · ping ฟังก์ชันทุก 30 นาที */
  const FNS = ['create-order', 'line-webhook', 'update-order-status', 'my-orders', 'line-login', 'share-customer-location'];
  async function ping() {
    return Promise.all(FNS.map(async name => {
      const t0 = Date.now();
      try { const r = await fetch(supabaseUrl + '/functions/v1/' + name, { method: 'OPTIONS', headers: { origin: 'https://cafe-order-web-admin-portal.github.io', 'access-control-request-method': 'POST' }, signal: AbortSignal.timeout(8000) }); await r.body?.cancel(); return { name, code: r.status, ms: Date.now() - t0 }; }
      catch (e) { return { name, code: 0, ms: Date.now() - t0, err: String(e.message || e).slice(0, 80) }; }
    }));
  }
  async function health(prev) {
    const [h] = await sql`select json_build_object(
      'staff', (select coalesce(json_agg(json_build_object('ref', s.cms_ref, 'name', s.staff_name, 'role', s.role, 'active', s.is_active, 'branch', b.branch_code, 'banned', coalesce(u.banned_until > now(), false), 'auth', u.id is not null)), '[]') from public.staff s left join public.branches b on b.id = s.branch_id left join auth.users u on u.id = s.auth_user_id),
      'branches', (select coalesce(json_agg(json_build_object('code', branch_code, 'name', branch_name, 'cms', cms_code, 'active', is_active)), '[]') from public.branches),
      'pending', (select json_build_object('n', count(*), 'oldest', min(created_at), 'first', (array_agg(order_number order by created_at))[1]) from public.orders where order_status = 'pending' and created_at < now() - interval '10 minutes' and created_at > now() - interval '2 days'),
      'today', (select count(*) from public.orders where created_at >= (date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'))) h`;
    const out = { at: new Date().toISOString(), ...h.h, fn: prev && prev.fn };
    try { out.lineChannels = (await sql`select b.branch_code branch, c.is_active active from public.line_channels c join public.branches b on b.id = c.branch_id`).map(r => ({ branch: r.branch, active: r.active })); }
    catch (_) { out.lineChannels = null; }   // ตารางของ Line-Order (GPT ดูแล) — เปลี่ยนชื่อ/ยังไม่มี ไม่ให้ผลตรวจอื่นพัง
    if (!out.fn || Date.now() - Date.parse(out.fn.at) > 30 * 60000) out.fn = { at: out.at, list: await ping() };
    return out;
  }
  return { syncAll, syncBranches, open, portal, health };
}
