# AGENTS.md — CMS (หลังร้าน Café Amazon: Owner & IT · เว็บหลังร้าน · แอปพนักงาน · LINE)

อ่านไฟล์นี้ก่อนแก้ — ใช้ร่วมกันระหว่าง AI ทุกตัว (ChatGPT/Codex, Claude) และคน
ระบบนี้เป็น **เจ้าของข้อมูลหลัก** (สาขา ผู้ใช้ สิทธิ์ พนักงาน) และซิงก์ไประบบออเดอร์ **Line-Order**
(repo `cafe-order-web-admin-portal/Line-Order`) บน Supabase project เดียวกัน `ytxbnqosenolojifeikf`

## โครงสร้าง
| ส่วน | ไฟล์ | หมายเหตุ |
|---|---|---|
| เว็บหลังร้าน (PC/มือถือ) | `index.html`, `js/app.js`, `js/mod-*.js` | เมนูตามสิทธิ์ (`GROUPS`, `defMod`) |
| แอป Owner & IT | `owner.html`, `js/owner*.js` | ระบบ IT, สาขา (`js/owner-branches.js`), อุปกรณ์, ลบบัญชี |
| แอปพนักงาน / LIFF | `clock.html`, `js/clock*.js`, `js/liff-view.js` | ใน LINE ต้องเบา ไม่โหลดของหนัก |
| หน้าจากการ์ด LINE | `line.html` | Supabase ส่ง HTML ตรงไม่ได้ → หน้านี้ดึง `?__fmt=page` |
| ที่อยู่ API | `js/config.js` → `AMZ_API` = `https://ytxbnqosenolojifeikf.supabase.co/functions/v1/backoffice` | JSONP `?action=…` |
| เซิร์ฟเวอร์ | Edge Function `backoffice` + `server/*.js` | ดูด้านล่าง |

## เซิร์ฟเวอร์ (Supabase)
- โค้ดธุรกิจทั้งหมด (.gs เดิมจาก Apps Script) อยู่ใน `server/gas.enc` (**เข้ารหัส AES-GCM — ห้ามแก้/ลบ/สร้างใหม่ด้วยมือ**)
  ฟังก์ชันโหลดจาก GitHub ทุก 60 วิ (ETag). ต้นฉบับ .gs อยู่นอก repo — ขอไฟล์ล่าสุดจากเจ้าของก่อนแก้ logic ฝั่งเซิร์ฟเวอร์
- `server/runtime.js` (ตัวรันโค้ด GAS), `server/store-pg.js` (ชีต→Postgres schema `backoffice`), `server/order-link.js` (เชื่อม Line-Order)
  ฟังก์ชัน `backoffice` import ไฟล์เหล่านี้ผ่าน jsDelivr **ปักที่ commit SHA** → แก้ไฟล์ใน `server/` แล้วต้อง deploy ฟังก์ชันใหม่ให้ชี้ SHA ใหม่ ไม่งั้นไม่มีผล
- ข้อมูล: schema `backoffice` (books / sheets / rows / kv / files / triggers) — ห้ามแก้แถวตรงๆ ยกเว้นจำเป็น (ต้อง bump `sheets.ver`)
- งานตั้งเวลา: pg_cron `backoffice-tick` ทุกนาที → `?__cron=1`
- คีย์ลับใน `backoffice.kv` (ns `props`): `CODE_KEY`, `CRON_KEY`, `IMPORT_KEY` — ห้ามแสดง/คัดลอกออก

## การเชื่อมกับ Line-Order (ทำงานทุกนาที — ใน `server/order-link.js`)
1. **สาขา** (`สาขา` → `public.branches`): รหัส ชื่อ เปิด/ปิด ที่อยู่ โทร พิกัด · จับคู่ด้วย `branches.cms_code` · สาขาใหม่ = สร้างให้ · ลบใน CMS = ปิด
2. **ผู้ใช้** (`ผู้ใช้ระบบ (Users)` → `public.staff` + Supabase Auth): ใช้ได้เมื่อ active + ตั้ง PIN แล้ว + มีสิทธิ์ `orders`/`catalog`
   Owner/Admin → `super_admin`, Manager/HR → `manager`, Staff → `staff`. `staff.cms_ref` = `owner` | `u:<user id>`
3. **SSO**: เมนู Order System → `orderTicket` (ตั๋ว 90 วิ) → `?__order=` → magic link → Line-Order `assets/sso.js`
4. **ระบบ IT** (แอป Owner): ผลตรวจระบบออเดอร์ใน props `ORDER_IT`, `ORDER_SYNC_LAST`, `ORDER_SSO_LOG`; ปุ่ม "ซิงก์ใหม่" = props `ORDER_SYNC_FORCE`
- สิทธิ์ใหม่ใน CMS: `orders` (Live Orders), `catalog` (Web Admin Portal)
- **ห้ามแก้สาขา/พนักงานในฝั่ง Line-Order โดยตรง** — จะถูกเขียนทับ ให้แก้ใน CMS

## กติกาธุรกิจที่ตั้งไว้ (อย่าเปลี่ยนโดยไม่ถามเจ้าของ)
- **ไม่ขอ OT อัตโนมัติ** จากเวลาลงงาน (ทุกช่องทาง): ออกงานเกินกะ → `otMin=0`, ไม่มี "OT รออนุมัติ" — พนักงานคีย์ "ขอ OT" เอง (ตาราง `otreq`)
  ฝั่งเซิร์ฟเวอร์ `57_NoAutoOT.gs` (ใน gas.enc) + หน้าเว็บ `js/no-auto-ot.js` · เปิดกลับ: ตั้งค่า `autoOT=true`
- หน้า Approvals มีประวัติการอนุมัติรายวัน (`js/approve-history.js`) — ต่อท้าย view ของ `mod-approve.js` อย่าแก้ไฟล์เดิมทับ
- **แอป Owner หน้าแรกมีแค่ 2 ปุ่ม: "จัดการร้าน" และ "ระบบ IT"** (`js/owner-landing.js` ตัดปุ่มอื่นทิ้ง) — อย่าเพิ่มปุ่มหน้าแรก
  ระบบออเดอร์เข้าทางเมนู Order System ในจัดการร้าน · สาขาอยู่ในเมนูของระบบ IT
- ระบบ IT ส่วนเติม `58_ITPlus.gs`: อนุมัติค้าง (ซ่อม `apRemind`), ตารางงาน, HR, Supabase (props `SUPA_IT`), อีเมล, Google เดิม (props `LEGACY_LOG`, คำขอที่มี `__via=google`), LINE OA ต่อสาขา
- สิทธิ์เห็นยอดลาคงเหลือ: เฉพาะผู้อนุมัติในเว็บ/แอป ไม่แสดงใน LINE/LIFF

## กติกาการแก้
- **สถานะล่าสุด / งานค้าง: `HANDOFF.md`** — อ่านต่อจากไฟล์นี้ และอัปเดตเมื่อส่งงาน
- ข้อความ UI ใหม่ห้ามอ้าง Google Sheet / Apps Script (ระบบอยู่ Supabase แล้ว) · ค่าเริ่มต้นสิทธิ์ต้องตรงกันทั้ง `js/mod-settings.js` และเซิร์ฟเวอร์
- **Theme / CSS หน้าตา แยกตาม Scope ผ่าน IT Control Center** (`js/app-scope.js` + ตาราง `it_control_settings`): ห้ามใส่ `<link>` Theme ตรงในหน้า html / ห้ามแก้ CSS ที่ใช้ร่วม (`app.css`, `theme-b.css`) เพื่อเปลี่ยนหน้าตาเฉพาะระบบเดียว — ทำ Theme ใหม่เป็นไฟล์ของตัวเอง แล้วเพิ่มใน `THEMES` และให้ Owner เปิดใช้เฉพาะ Scope ที่ต้องการ
- ดึงโค้ดล่าสุดก่อน (`git pull --rebase`) — มีหลาย AI ทำงานใน repo เดียวกัน
- **ฟีเจอร์ใหม่ = ไฟล์ใหม่** แก้ไฟล์เดิมให้น้อยที่สุด (ต่อยอดด้วยการ wrap ฟังก์ชันเดิม) · ส่งเฉพาะไฟล์ที่เปลี่ยนจริง
- แยก PC / มือถือ / เว็บ / แอป / LINE ไม่ให้กระทบกัน · ใน LINE/LIFF ห้ามโหลดรูปหรือของหนักโดยไม่จำเป็น
- เปลี่ยนไฟล์ js แล้วเพิ่มเลข `?v=` ในหน้า html ที่โหลดไฟล์นั้น
- ข้อความ UI / คอมเมนต์ ภาษาไทย · ไม่เปิดเผยอีเมล/ข้อมูลส่วนตัวผู้ใช้ในโค้ดหรือ log
