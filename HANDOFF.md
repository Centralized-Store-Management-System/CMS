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

## Owner PWA PIN Lock (19 พ.ย. 2569)
- เพิ่ม `js/owner-pwa-lock.js` และโหลดเฉพาะใน `owner.html`; ปรับ `js/owner.js` และ `css/owner.css` เท่านั้น
- ทำงานเฉพาะเมื่อเปิด Owner เป็น PWA/standalone: หลัง Login + MFA เดิมสำเร็จ ให้ตั้ง PIN 6 หลัก; ครั้งถัดไปปลดล็อกด้วย PIN แล้วตรวจ token ผ่าน API `me` ก่อนเข้า Owner Console
- Token ถูกเก็บเป็น ciphertext AES-GCM โดยใช้ key จาก PBKDF2-SHA256 (310,000 iterations), random salt/IV; มีหน่วงหลังใส่ PIN ผิด 5 ครั้ง
- Logout ล้าง vault; Session หมดอายุ/ถูกปฏิเสธจะล้าง vault และให้ Login + MFA ใหม่
- PC / Mobile Browser ที่ไม่ใช่ standalone, Mgr / Staff / LINE ไม่โหลดโมดูลนี้และไม่เปลี่ยน flow
- **ข้อจำกัดด้านความปลอดภัย:** PIN 6 หลักมี entropy จำกัดและ ciphertext ในเครื่องยังเสี่ยงต่อ offline brute-force หากผู้โจมตีได้ข้อมูล storage; ฟีเจอร์นี้เป็น local session unlock เพื่อความสะดวก ไม่ใช่การแทน MFA หรือการยืนยันตัวตนฝั่งเซิร์ฟเวอร์
- ยังต้องทดสอบบนอุปกรณ์จริง (Android PWA และ iOS Add to Home Screen): ตั้ง PIN, ปิด/เปิดแอป, PIN ผิด, logout, session หมดอายุ, offline/network error ก่อนถือว่า production-verified

## ค้าง / รอเจ้าของ
- **อีเมล (Resend)**: เจ้าของต้องตั้ง Edge Function Secrets `RESEND_API_KEY`, `MAIL_FROM` เอง (ต้องมีโดเมนที่ verify จึงส่งถึงพนักงานได้) → แล้วตรวจข้อ IT `auth_mail`
- (เสนอไว้) แยกสิทธิ์ orders/catalog รายคนใน Line-Order
- (เสนอไว้) เก็บ Apps Script deployment เดิมหลัง 1–2 สัปดาห์ที่ไม่มีคำขอ `__via=google`

## ข้อควรระวัง
- โค้ดเซิร์ฟเวอร์อยู่ใน `server/gas.enc` (เข้ารหัส) — ต้นฉบับ .gs อยู่นอก repo, ห้ามแก้ไฟล์ .enc ด้วยมือ
- `js/order-link.js` GPT แก้ล่าสุด (หน้าออเดอร์ในแอป Owner) — Claude ไม่ได้แตะหลังจากนั้น
- อย่าใส่คีย์ลับใดๆ ในไฟล์ / แชต
