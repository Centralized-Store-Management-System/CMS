// เชื่อมผู้ใช้หลังร้าน (CMS) → ระบบออเดอร์ (public.staff + Supabase Auth) และเข้าระบบออเดอร์อัตโนมัติ (SSO)
// - syncAll(roster): ทำให้ public.staff ตรงกับรายชื่อจาก orderRoster_() (54_OrderLink.gs) — เพิ่ม / แก้ Role-สาขา / ปิด
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

  async function apply(B, u) {
    let [cur] = await sql`select id, auth_user_id, role, branch_id, staff_name, is_active from public.staff where cms_ref = ${u.ref}`;
    if (!cur && u.ref === 'owner') {   // Owner = บัญชี super_admin เดิมของระบบออเดอร์
      [cur] = await sql`select id, auth_user_id, role, branch_id, staff_name, is_active from public.staff where cms_ref is null and role = 'super_admin' order by created_at limit 1`;
      if (cur) await sql`update public.staff set cms_ref = 'owner' where id = ${cur.id}`;
    }
    if (!u.active) {
      if (!cur) return 'skip';
      if (cur.is_active) { await sql`update public.staff set is_active = false where id = ${cur.id}`; if (u.ref !== 'owner') await ban(cur.auth_user_id, true); return 'off'; }
      return 'same';
    }
    const branch = u.ref === 'owner' && cur ? cur.branch_id : branchFor(B, u.branch);
    if (!branch) throw new Error('ระบบออเดอร์ยังไม่มีสาขา');
    if (!cur) {
      const email = emailOf(u.ref);
      let id;
      try { id = (await admin('POST', 'users', { email, email_confirm: true, user_metadata: { name: u.name, cms_ref: u.ref }, app_metadata: { source: 'cms' } })).id; }
      catch (e) { const [x] = await sql`select id from auth.users where email = ${email}`; if (!x) throw e; id = x.id; await ban(id, false); }
      await sql`insert into public.staff (auth_user_id, branch_id, staff_name, role, is_active, cms_ref) values (${id}, ${branch}, ${u.name}, ${u.role}, true, ${u.ref})`;
      return 'new';
    }
    if (cur.role === u.role && cur.branch_id === branch && cur.staff_name === u.name && cur.is_active) return 'same';
    await sql`update public.staff set role = ${u.role}, branch_id = ${branch}, staff_name = ${u.name}, is_active = true where id = ${cur.id}`;
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

  async function open(u, page) {
    await apply(await branches(), u);
    const [s] = await sql`select u.email from public.staff s join auth.users u on u.id = s.auth_user_id where s.cms_ref = ${u.ref} and s.is_active`;
    if (!s || !s.email) throw new Error('ยังไม่พบบัญชีในระบบออเดอร์');
    const j = await admin('POST', 'generate_link', { type: 'magiclink', email: s.email });
    const hash = j.hashed_token || (j.properties && j.properties.hashed_token);
    if (!hash) throw new Error('สร้างลิงก์เข้าระบบไม่ได้');
    return portal + (page === 'catalog' ? '' : 'orders.html') + '#sso=' + encodeURIComponent(hash);
  }
  return { syncAll, open, portal };
}
