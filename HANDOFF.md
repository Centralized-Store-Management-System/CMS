# HANDOFF — สถานะล่าสุด (สำหรับ AI ตัวถัดไป: ChatGPT/Codex, Claude)

อัปเดต: 19 พ.ย. 2569 (Claude) · อ่าน `AGENTS.md` ก่อนเสมอ แล้วอ่านไฟล์นี้เพื่อรู้ว่าทำอะไรไปแล้ว / ค้างอะไร

## ภาพรวมตอนนี้
- **ระบบทั้งหมดย้ายจาก Google Apps Script → Supabase แล้ว (19 พ.ย. 2569 09:28)**
  - หน้าเว็บ / แอป / LINE LIFF เรียก `AMZ_API` = Edge Function `backoffice` (ดู `js/config.js`)
  - Google Sheet เดิมหยุดอัปเดตแล้ว เป็นสำเนาเก่า **ห้ามแก้ข้อมูลในชีต** (ไม่เข้าระบบ)
  - ตัวส่งต่อใน Apps Script เดิม (`99_ForwardToSupabase.gs`, อยู่นอก repo) ทำงานแล้ว: ลิงก์ `script.google.com/.../exec` เก่าส่งต่อเข้า Supabase พร้อม `__via=google` (บันทึกใน props `LEGACY_LOG`, ระบบ IT ข้อ "การเรียกใช้ที่ยังส่งไป Google")
- Edge Function `backoffice` = **v10**, import `server/*.js` ผ่าน jsDelivr ปักที่ SHA `600f9eda0ac0d5ae7a8a15b115c2512dc32e7d55`
  (แก้ `server/` แล้วต้อง deploy ใหม่ให้ชี้ SHA ใหม่)

## ทำเสร็จแล้ว (ล่าสุดก่อน)
1. **ข้อความ Google → Supabase ทุกหน้าจอ** (`js/supa-ui.js`): แทนคำในหน้าจอแบบไม่แก้ไฟล์เดิม — "ชีต" → "ตาราง", "Apps Script" → "เซิร์ฟเวอร์", Drive → ที่เก็บไฟล์, หน้า Settings > Data แสดง Supabase
   - โหลดเฉพาะ `index.html`, `owner.html` (ไม่โหลดใน `clock.html` / LIFF เพื่อให้เบา — หน้า clock ไม่มีคำ Google ที่ผู้ใช้เห็น)
   - คงไว้โดยตั้งใจ: "Google Authenticator", "นำเข้าจาก Excel หรือ Google Sheet" (ผู้ใช้วางจากชีตของตัวเอง), ข้อตรวจ IT เรื่องตัวส่งต่อ Google เดิม
   - ฝั่งเซิร์ฟเวอร์ `59_SupaLabels.gs` เปลี่ยนชื่อข้อตรวจ IT (runtime/edit_trigger/photos)
   - **ข้อความใหม่ห้ามเขียนว่า Google Sheet / Apps Script** — ใช้ "ฐานข้อมูล" / "เซิร์ฟเวอร์"
2. **Settings > Permissions**: หน้าเว็บแสดงค่าเริ่มต้น `orders`/`catalog` ตรงกับเซิร์ฟเวอร์แล้ว (`js/mod-settings.js` `DEFAULT_PERMS`)
   - ค่าเริ่มต้น (ตอนยังไม่เคยกด "บันทึกสิทธิ์"): Admin/Manager = orders+catalog, Staff = orders, HR = ไม่มี
   - ค่าเริ่มต้นฝั่งเซิร์ฟเวอร์อยู่ `54_OrderLink.gs` — **ถ้าเปลี่ยน ต้องแก้ทั้ง 2 ที่ให้ตรงกัน**
   - เอาติ๊กออก + บันทึก → ภายใน ~1 นาที เมนูระบบออเดอร์หาย + บัญชีใน Line-Order ถูกปิด (ซิงก์ `orderSync`)
   - ข้อจำกัด: Line-Order แยกสิทธิ์ตาม role ไม่ได้แยก orders/catalog รายคน (เข้าแล้วเปิด Web Admin Portal ได้ตามระดับ) — ยังไม่ได้แก้
3. ตัวส่งต่อ Apps Script → Supabase (ทดสอบแล้ว 16:15)
4. แอป Owner หน้าแรก 2 ปุ่ม (`js/owner-landing.js`) · ระบบ IT เพิ่ม `58_ITPlus.gs` (อนุมัติค้าง/ตาราง/HR/Supabase/อีเมล/Google เดิม/LINE ต่อสาขา)
5. Approvals: ประวัติรายวัน (`js/approve-history.js`) · ไม่ขอ OT อัตโนมัติ (`57_NoAutoOT.gs` + `js/no-auto-ot.js`)
6. คำขอผ่าน LINE LIFF ไม่เข้า Approvals → แก้ `js/core.js` (ไม่ใช้ `?api=` ของ Google) + ย้าย 3 รายการค้าง
7. ซิงก์ CMS ↔ Line-Order: สาขา (B0001 = สาขาตลาดทวีสมาน, เดิม PKT001), ผู้ใช้, SSO, ตรวจ IT 7 ข้อ, เปลี่ยนชื่อสาขาในแอป Owner > ระบบ IT > สาขา

## แอป Owner ปลดล็อกด้วยรหัส 6 หลัก (19 พ.ย. 2569 รอบ 2 — Claude แทนที่รุ่นเก็บ token)
- **สาเหตุที่รุ่นก่อนยังขึ้น Authenticator:** vault เก็บ session token ซึ่งหมดอายุใน 6 ชม. (`SESSION_SECONDS`) → เปิดแอปวันถัดไป `me` = SESSION → ลบ vault → กลับไป Login + Authenticator · และหน้า "จัดการร้าน" (index.html) ไม่ได้รับ session ต่อ
- **ตอนนี้:** ใช้กลไกเดียวกับแอปพนักงาน (48_AppLock) — เซิร์ฟเวอร์ผูกเครื่อง `60_OwnerAppLock.gs` (ใน gas.enc): `devReg {app:'owner'}` (ต้องผ่าน Authenticator แล้ว `af` ตรงวิธีที่ตั้ง) · `devUnlock` เครื่อง uid=`owner` → ออก session Owner ใหม่ทุกครั้ง
- หน้าเว็บ `js/owner-pwa-lock.js` (โหลดใน `owner.html` และท้าย `index.html` — ทำงานเฉพาะแอปที่ติดตั้ง/`?app=1` + เปิดจากแอป Owner + มีรหัสแล้ว)
  - เก็บกุญแจเครื่อง `{id, secret}` แบบ AES-256-GCM (PBKDF2-SHA256 310,000 รอบ, salt/IV สุ่ม) ใน localStorage `amz.owner.pwa.v2` · ไม่เก็บรหัส
  - เปิดแอป → หน้ารหัส → ถอดกุญแจในเครื่อง → `devUnlock` (เซิร์ฟเวอร์ตรวจรหัสอีกชั้น ผิด 5 = ล็อกเครื่อง)
  - session หมดระหว่างใช้ → ต่ออายุเงียบ (ห่อ `API.call`) · ออกจากแอป > 1 นาที → ล็อก · เปิดหน้าจัดการร้านส่ง session ต่อ (`amz.tok`)
  - ผิด 5 ครั้งพัก 5 นาที (จำในเครื่อง) · ผิดรวม 10 ลบกุญแจ · เน็ตหลุดไม่ลบกุญแจ · Logout = ลบกุญแจ + `devForget`
  - Owner ยกเลิกเครื่องได้ที่ ระบบ IT > วิธีเข้าระบบ (รายการเดียวกับแอปพนักงาน)
- ลำดับในแอป (ตามที่เจ้าของกำหนด): เปิดแอปครั้งแรก → หน้าเข้าระบบทันที (ก่อนเมนู) → User + PIN + Authenticator → ตั้งรหัส 6 หลัก → หน้าหลัก · ครั้งต่อไป เปิดแอป → รหัส 6 หลัก → หน้าหลัก (ทั้ง 2 เมนูเข้าได้เลย)
- ปุ่ม "ออกจากระบบ" ในแอป = จบ session แต่เก็บรหัส (เข้าใหม่ใช้รหัส) · ล้างจริงใช้ "ลืมรหัส" ที่หน้ารหัส
- เฉพาะมือถือ/แท็บเล็ต: แอปที่ติดตั้งบน PC ใช้ระบบเดิม (รหัสที่เคยตั้งบน PC ถูกล้างอัตโนมัติ)
- ไม่กระทบ: PC/เบราว์เซอร์ปกติ (Owner ยังใช้ Authenticator), Mgr/Staff (app-lock.js เดิม), LINE
- ทดสอบแล้ว: gasmock `test/ownerlock.test.js` 5 ข้อ + ทดสอบหน้าเว็บจริง (Chromium จำลอง iPhone) 24 ข้อ — **ยังไม่ได้ทดสอบบน iPhone / Android จริง**
- ข้อจำกัด: ถ้าได้ไฟล์ localStorage ไป ยังเดารหัส 6 หลักแบบ offline ได้ (ช้าเพราะ PBKDF2) แต่ต้องมีกุญแจ + รหัสตรงที่เซิร์ฟเวอร์ และ Owner ยกเลิกเครื่องได้ทันที

## ค้าง / รอเจ้าของ
- **อีเมล (Resend)**: เจ้าของต้องตั้ง Edge Function Secrets `RESEND_API_KEY`, `MAIL_FROM` เอง (ต้องมีโดเมนที่ verify จึงส่งถึงพนักงานได้) → แล้วตรวจข้อ IT `auth_mail`
- (เสนอไว้) แยกสิทธิ์ orders/catalog รายคนใน Line-Order
- (เสนอไว้) เก็บ Apps Script deployment เดิมหลัง 1–2 สัปดาห์ที่ไม่มีคำขอ `__via=google`

## ข้อควรระวัง
- โค้ดเซิร์ฟเวอร์อยู่ใน `server/gas.enc` (เข้ารหัส) — ต้นฉบับ .gs อยู่นอก repo, ห้ามแก้ไฟล์ .enc ด้วยมือ
- `js/order-link.js` GPT แก้ล่าสุด (หน้าออเดอร์ในแอป Owner) — Claude ไม่ได้แตะหลังจากนั้น
- อย่าใส่คีย์ลับใดๆ ในไฟล์ / แชต


## แก้ปัญหา Login กระพริบระหว่างทำงาน (19 พ.ย. 2569)
- ตรวจพบต้นเหตุใน `js/owner-pwa-lock.js`: ตัวครอบ `renderLogin()` วาด Login เดิมก่อนเริ่ม `unlockFlow()` แบบ asynchronous และ `unlockFlow()` ไม่รวมคำขอปลดล็อกซ้อนกัน
- อีกจุดใน `js/owner.js`: `ocGo()` ส่งทั้ง `SESSION` และ `PERM` ไปหน้า Login อัตโนมัติ; ปรับให้ `PERM` แจ้งสิทธิ์ในหน้าเดิม และ `SESSION` คงหน้า Owner Console พร้อมปุ่มให้ผู้ใช้เลือกเชื่อมต่อใหม่
- แก้แล้ว: ไม่วาด Login ระหว่าง Owner PWA กำลังปลดล็อก, รวมคำขอปลดล็อกเป็น Promise เดียว, คงหน้าเดิมเมื่อ session/permission error, เพิ่มปุ่มเชื่อมต่อใหม่; bump `owner-pwa-lock.js` เป็น v2.1.2 ใน `owner.html` และ `index.html`
- Function ที่เชื่อมต่อ: `login`, `auth2`, `me`, `logout`, `devReg`, `devUnlock`, `devForget`, `it` (ops: `status/dash/perf/events/authList/healAll/heal/authSet`), `staff`, `orderTicket`
- รายงาน IT: `docs/IT-REPORT-OWNER-AUTH-FLOW.md`
- Commits: `df2181a` (Owner PWA lock), `90bd7a0` (Owner Console session handling), `6527bee` (`owner.html` cache-bust), `702cf5a` (`index.html` cache-bust), `983a45d` (IT report)
- ขอบเขต: Front-end เท่านั้น ไม่แก้ Edge Function หรือ `server/gas.enc`; ยังต้องทดสอบบน iPhone/Android จริงก่อนปิดงาน
