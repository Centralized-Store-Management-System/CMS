// ที่เก็บข้อมูลจริง: Postgres (schema backoffice) + Supabase Storage — ใช้ใน Edge Function (Deno)
// postgres = ไลบรารี npm:postgres ส่งเข้ามาจาก index.ts (โมดูลที่โหลดจาก GitHub ใช้ npm: ตรงไม่ได้)
import { Buffer } from 'node:buffer';

const LOCK_KEY = 7310427;   // ล็อกตอนบันทึก (คำขอเขียนพร้อมกันเข้าคิวทีละคำขอ สั้นมาก)

export function pgStore({ postgres, dbUrl, supabaseUrl, serviceKey, resendKey, mailFrom }) {
  const sql = postgres(dbUrl, { max: 4, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  const storage = (bucket, path) => `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const auth = { Authorization: 'Bearer ' + serviceKey, apikey: serviceKey };
  const pathOf = id => 'f/' + id;

  async function put(bucket, id, bytes, mime) {
    const r = await fetch(storage(bucket, pathOf(id)), { method: 'POST', headers: { ...auth, 'content-type': mime || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: bytes });
    if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  async function get(bucket, id) {
    const r = await fetch(storage(bucket, pathOf(id)), { headers: auth });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  async function del(bucket, id) { await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [pathOf(id)] }) }).catch(() => {}); }
  const fileRec = f => f && { id: f.id, folder: f.folder, name: f.name, mime: f.mime, size: f.size, shared: f.shared, trashed: f.trashed, description: f.description || '' };

  return {
    sql,
    async meta() {
      const [r] = await sql`select json_build_object(
        'books', (select coalesce(json_agg(json_build_object('id', id, 'name', name)), '[]') from backoffice.books),
        'sheets', (select coalesce(json_agg(json_build_object('book', book, 'name', name, 'ver', ver, 'ord', ord)), '[]') from backoffice.sheets),
        'props', (select coalesce(json_object_agg(k, v), '{}') from backoffice.kv where ns = 'props' and k not in ('CODE_KEY', 'CRON_KEY', 'IMPORT_KEY')),
        'cache', (select coalesce(json_agg(json_build_object('k', k, 'v', v, 'exp', (extract(epoch from exp) * 1000)::bigint)), '[]') from backoffice.kv where ns = 'cache' and (exp is null or exp > now())),
        'folders', (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'parent', parent)), '[]') from backoffice.folders),
        'triggers', (select coalesce(json_agg(json_build_object('id', id, 'fn', fn, 'spec', spec)), '[]') from backoffice.triggers)
      ) m`;
      return r.m;
    },
    async loadSheet(book, name) {
      const [s] = await sql`select ver from backoffice.sheets where book = ${book} and name = ${name}`;
      const rows = await sql`select r, vals from backoffice.rows where book = ${book} and sheet = ${name} order by r`;
      const out = [];
      for (const x of rows) { while (out.length < x.r - 1) out.push([]); out[x.r - 1] = x.vals; }
      return { ver: s ? Number(s.ver) : 0, rows: out };
    },
    /** หลายแผ่นในคำสั่งเดียว → { 'book|name': { ver, rows } } */
    async loadSheets(list) {
      if (!list.length) return {};
      const pairs = JSON.stringify(list);
      const vs = await sql`select book, name, ver from backoffice.sheets where (book, name) in (select x->>0, x->>1 from jsonb_array_elements(${pairs}::text::jsonb) x)`;
      const rows = await sql`select book, sheet, r, vals from backoffice.rows where (book, sheet) in (select x->>0, x->>1 from jsonb_array_elements(${pairs}::text::jsonb) x) order by book, sheet, r`;
      const out = {};
      for (const v of vs) out[v.book + '|' + v.name] = { ver: Number(v.ver), rows: [] };
      for (const x of rows) { const o = out[x.book + '|' + x.sheet]; if (!o) continue; while (o.rows.length < x.r - 1) o.rows.push([]); o.rows[x.r - 1] = x.vals; }
      return out;
    },
    async fileMeta(id) { const [f] = await sql`select * from backoffice.files where id = ${id}`; return fileRec(f) || null; },
    async filesByName(folder, name) { return (await sql`select * from backoffice.files where folder = ${folder} and name = ${name} and not trashed order by created_at`).map(fileRec); },
    async fileBytes(rec) { return (await get(rec.shared ? 'backoffice-public' : 'backoffice', rec.id)) || (await get(rec.shared ? 'backoffice' : 'backoffice-public', rec.id)) || Buffer.alloc(0); },
    async fetch(url, opts) {
      const headers = { ...(opts.headers || {}) };
      if (opts.contentType) headers['content-type'] = opts.contentType;
      try {
        const r = await fetch(url, { method: opts.method.toUpperCase(), headers, body: opts.payload });
        const bytes = Buffer.from(await r.arrayBuffer());
        return { code: r.status, text: bytes.toString('utf8'), bytes, headers: Object.fromEntries(r.headers) };
      } catch (e) { return { code: 599, text: String(e.message || e) }; }
    },
    async sendLine(url, opts) {
      const r = await this.fetch(url, opts);
      if (r.code >= 400) await sql`insert into backoffice.outbox_errors (kind, target, detail) values ('line', ${url}, ${String(r.text).slice(0, 500)})`.catch(() => {});
      return { code: r.code, text: r.text };
    },
    async commit(ch) {
      // ไฟล์: อัปโหลดก่อนบันทึก (รหัสไฟล์คงที่เมื่อรันซ้ำ จึงเขียนทับได้)
      for (const op of ch.files) {
        const r = op.rec;
        if (op.op === 'create') await put(r.shared ? 'backoffice-public' : 'backoffice', r.id, op.bytes, r.mime);
        else if (op.op === 'copy') { const b = await this.fileBytes(op.from); await put(r.shared ? 'backoffice-public' : 'backoffice', r.id, b, r.mime); }
      }
      try {
        const vers = await sql.begin(async tx => {
          await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
          const want = ch.sheets.map(s => [s.book, s.oldName || s.name, s]).concat(ch.deleteSheets.map(s => [s.book, s.name, s]));
          if (want.length) {
            const cur = await tx`select book, name, ver from backoffice.sheets where (book, name) in (select x->>0, x->>1 from jsonb_array_elements(${JSON.stringify(want.map(w => [w[0], w[1]]))}::text::jsonb) x)`;
            const m = new Map(cur.map(c => [c.book + '|' + c.name, Number(c.ver)]));
            const conflict = [];
            for (const [b, n, s] of want) { const v = m.get(b + '|' + n); if (s.fresh ? v !== undefined : (v === undefined ? s.ver !== 0 : v !== s.ver)) conflict.push(b + '|' + s.name); }
            if (conflict.length) { const e = new Error('conflict'); e.conflict = conflict; throw e; }
          }
          for (const b of ch.books) await tx`insert into backoffice.books (id, name) values (${b.id}, ${b.name}) on conflict (id) do update set name = excluded.name`;
          const out = {};
          for (const s of ch.sheets) {
            if (s.oldName) await tx`update backoffice.sheets set name = ${s.name} where book = ${s.book} and name = ${s.oldName}`;
            if (s.fresh) await tx`insert into backoffice.sheets (book, name, ord) values (${s.book}, ${s.name}, ${s.ord}) on conflict (book, name) do nothing`;
            if (s.rows.length) await tx`insert into backoffice.rows (book, sheet, r, vals)
              select ${s.book}, ${s.name}, (x->>0)::int, x->1 from jsonb_array_elements(${JSON.stringify(s.rows)}::text::jsonb) x
              on conflict (book, sheet, r) do update set vals = excluded.vals`;
            await tx`delete from backoffice.rows where book = ${s.book} and sheet = ${s.name} and r > ${s.nrows}`;
            const [u] = await tx`update backoffice.sheets set ver = ver + 1, nrows = ${s.nrows}, updated_at = now() where book = ${s.book} and name = ${s.name} returning ver`;
            out[s.book + '|' + s.name] = Number(u.ver);
          }
          for (const s of ch.deleteSheets) await tx`delete from backoffice.sheets where book = ${s.book} and name = ${s.name}`;
          for (const [k, v] of ch.props.filter(([k]) => !['CODE_KEY', 'CRON_KEY', 'IMPORT_KEY'].includes(k))) {
            if (v === null) await tx`delete from backoffice.kv where ns = 'props' and k = ${k}`;
            else await tx`insert into backoffice.kv (ns, k, v) values ('props', ${k}, ${v}) on conflict (ns, k) do update set v = excluded.v`;
          }
          const cDel = ch.cache.filter(c => c.v === null).map(c => c.k), cPut = ch.cache.filter(c => c.v !== null);
          if (cDel.length) await tx`delete from backoffice.kv where ns = 'cache' and k in (select jsonb_array_elements_text(${JSON.stringify(cDel)}::text::jsonb))`;
          if (cPut.length) await tx`insert into backoffice.kv (ns, k, v, exp)
            select 'cache', x->>'k', x->>'v', (x->>'exp')::timestamptz from jsonb_array_elements(${JSON.stringify(cPut)}::text::jsonb) x
            on conflict (ns, k) do update set v = excluded.v, exp = excluded.exp`;
          for (const f of ch.folders) await tx`insert into backoffice.folders (id, name, parent) values (${f.id}, ${f.name}, ${f.parent || null}) on conflict (id) do nothing`;
          for (const op of ch.files) {
            const r = op.rec;
            if (op.op === 'create' || op.op === 'copy') await tx`insert into backoffice.files (id, folder, name, mime, path, size, shared, trashed) values (${r.id}, ${r.folder || null}, ${r.name}, ${r.mime || null}, ${'f/' + r.id}, ${r.size || 0}, ${!!r.shared}, ${!!r.trashed}) on conflict (id) do update set shared = excluded.shared, trashed = excluded.trashed, folder = excluded.folder`;
            else await tx`update backoffice.files set shared = ${!!r.shared}, trashed = ${!!r.trashed}, folder = ${r.folder || null} where id = ${r.id}`;
          }
          if (ch.triggers) {
            await tx`delete from backoffice.triggers where id not in (select jsonb_array_elements_text(${JSON.stringify(ch.triggers.map(t => t.id).concat(['-']))}::text::jsonb))`;
            for (const t of ch.triggers) await tx`insert into backoffice.triggers (id, fn, spec) values (${t.id}, ${t.fn}, ${JSON.stringify(t.spec || {})}::text::jsonb) on conflict (id) do update set fn = excluded.fn, spec = excluded.spec`;
          }
          await tx`delete from backoffice.kv where ns = 'cache' and exp < now() - interval '1 minute' and random() < 0.05`;
          return out;
        });
        // ไฟล์ที่แชร์ทีหลัง / ลบ: ย้ายระหว่าง bucket หลังบันทึก
        for (const op of ch.files) {
          if (op.op === 'share') { const b = await get('backoffice', op.rec.id); if (b) { await put('backoffice-public', op.rec.id, b, op.rec.mime); await del('backoffice', op.rec.id); } }
          if (op.op === 'trash' && op.rec.trashed) { /* เก็บไว้ในถังขยะ (กู้คืนได้) */ }
        }
        return { ok: true, vers };
      } catch (e) {
        if (e.conflict) return { conflict: e.conflict };
        throw e;
      }
    },
    async afterCommit(out) {
      for (const m of out.mail) {
        if (!resendKey) { await sql`insert into backoffice.outbox_errors (kind, target, detail) values ('mail', ${String(m.to || '')}, 'ยังไม่ได้ตั้ง RESEND_API_KEY')`.catch(() => {}); continue; }
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + resendKey, 'content-type': 'application/json' },
          body: JSON.stringify({ from: (m.name ? m.name + ' <' + mailFrom + '>' : mailFrom), to: String(m.to || '').split(',').map(s => s.trim()).filter(Boolean), subject: m.subject || '', html: m.htmlBody || undefined, text: m.body || undefined, reply_to: m.replyTo || undefined }) }).catch(e => ({ ok: false, text: async () => String(e) }));
        if (!r.ok) await sql`insert into backoffice.outbox_errors (kind, target, detail) values ('mail', ${String(m.to || '')}, ${String(await r.text()).slice(0, 500)})`.catch(() => {});
      }
    }
  };
}
