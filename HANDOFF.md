# HANDOFF — สถานะล่าสุด (สำหรับ AI ตัวถัดไป: ChatGPT/Codex, Claude)

อัปเดต: 19 พ.ย. 2569 (Claude) · อ่าน `AGENTS.md` ก่อนเสมอ แล้วอ่านไฟล์นี้เพื่อรู้ว่าทำอะไรไปแล้ว / ค้างอะไร

## ภาพรวมตอนนี้
- **ระบบทั้งหมดย้ายจาก Google Apps Script → Supabase แล้ว (19 พ.ย. 2569 09:28)**
  - หน้าเว็บ / แอป / LINE LIFF เรียก `AMZ_API` = Edge Function `backoffice` (ดู `js/config.js`)
  - Google Sheet เดิมหยุดอัปเดตแล้ว เป็นสำเนาเก่า **ห้ามแก้ข้อมูลในชีต** (ไม่เข้าระบบ)
  - ตัวส่งต่อใน Apps Script เดิม (`99_ForwardToSupabase.gs`, อยู่นอก repo) ทำงานแล้ว: ลิงก์ `script.google.com/.../exec` เก่าส่งต่อเข้า Supabase พร้อม `__via=google` (บันทึกใน props `LEGACY_LOG`, ระบบ IT ข้อ "การเรียกใช้ที่ยังส่งไป Google")
- Edge Function `backoffice` = **v10**, import `server/*.js` ผ่าน jsDelivr ปักที่ SHA `600f9eda0ac0d5ae7a8a15b115c2512dc32e7d55`
  (แก้ `server/` แล้วต้อง deploy ใหม่ให้ชี้ SHA ใหม่)

## ลืม PIN → รับรหัสทาง LINE (22 พ.ย. 2569 · Claude) — แทนรหัสทางอีเมล
- **ผู้ใช้ใหม่**: Owner/Admin สร้างผู้ใช้ → ได้รหัสเปิดใช้งาน 6 หลัก (ใช้ได้ 7 วัน) → พนักงานกด "เข้าใช้งานครั้งแรก" ตั้ง PIN เอง (เดิม ไม่เปลี่ยน)
- **ลืม PIN**: ปุ่ม "ลืม PIN? ขอรหัสทาง LINE" (`js/line-reset.js` แทน `email-otp.js` ซึ่งเลิกโหลดแล้ว) ขึ้น**เฉพาะเมื่อรหัสที่พิมพ์ผูก LINE แล้ว** (ถามเซิร์ฟเวอร์ `lineResetCheck`)
  อยู่ที่: หลังร้าน Sign in (PC/มือถือ/iPad) · หน้าลงเวลา (ขั้นใส่รหัส และขั้นใส่ PIN) · ปุ่ม "ลืมรหัส" ของแอปล็อกเครื่องพากลับมาหน้าเหล่านี้ · ไม่แสดงใน LINE/LIFF และหน้า Owner
- เซิร์ฟเวอร์ `61_LineReset.gs` (ใน gas.enc): `lineResetCheck` / `lineResetSend` / `lineResetVerify` — รหัส 6 หลัก ใช้ได้ 10 นาที ผิดได้ 5 ครั้ง ขอได้วันละ 5 ครั้ง ห่าง 1 นาที ส่งไป LINE ID ที่ผูกไว้เท่านั้น
  **ไม่รวม** Owner/Admin และบัญชีที่ตั้ง Authenticator / Passkey / ยืนยันใน LINE (ต้องให้ Owner กด "รีเซ็ตรหัส") · คนไม่ผูก LINE → ให้ Owner/HR รีเซ็ตรหัส
- `otpSend` / `otpVerify` (อีเมล) ถูกปิด ตอบข้อความให้ใช้ LINE · ไม่ต้องตั้ง `RESEND_API_KEY` อีกต่อไป
- ต้นฉบับ `.gs` ยังอยู่นอก repo (repo นี้ Public) — อย่า commit `.gs` ลงที่นี่ · แก้ logic ฝั่งเซิร์ฟเวอร์ต้องขอซอร์สจากเจ้าของ/repo private แล้วเข้ารหัส `gas.enc` ใหม่

## ส่งต่อให้ AI ตัวถัดไป (22 พ.ย. 2569 · Claude) — อ่านก่อนเริ่ม
- เริ่มทุกครั้ง: `git pull --rebase` → อ่าน `AGENTS.md` + ไฟล์นี้ → ทำงานบน branch ใหม่ → เปิด PR ให้เจ้าของกด merge (merge main ผ่าน API ไม่ได้) → รายงาน commit SHA + รายการไฟล์ที่เปลี่ยน
- เปิด PR จาก Claude Code: `gh pr create` ใช้ไม่ได้ (GraphQL ถูกบล็อก) ให้ใช้ `gh api repos/Centralized-Store-Management-System/CMS/pulls -f title=… -f head=… -f base=main -F body=@ไฟล์`
- **ซอร์สฝั่งเซิร์ฟเวอร์ (อ่าน/แก้ง่าย)**: อยู่ใน repo **Private** `Centralized-Store-Management-System/CMS-server-src` (`gas/*.gs` + `tools/build.mjs` + ทดสอบ + README ขั้นตอนแก้) — ตรงกับ `gas.enc` หลัง PR #35 · แก้ที่นั่น → build → เข้ารหัส → PR `server/gas.enc` ใน repo นี้ · ห้ามเปลี่ยน repo นั้นเป็น Public
- **ซอร์สฝั่งเซิร์ฟเวอร์ (สำรอง)**: `server/gas.enc` ก็คือซอร์ส `.gs` ทั้งหมดที่เข้ารหัสไว้ — ถ้า repo private ไม่มี ก็กู้ได้ ถ้ามีสิทธิ์อ่านกุญแจ `CODE_KEY` (อยู่ใน `backoffice.kv` ns `props` ห้ามใส่ใน repo/log/แชต) ใช้ `tools/gas-crypt.mjs`:
  `CODE_KEY=… node tools/gas-crypt.mjs decrypt server/gas.enc <ที่นอก repo>/all.gs` → แก้ → `… encrypt <ที่นอก repo>/all.gs server/gas.enc` (ถอดกลับเทียบ + ตรวจ syntax ให้เอง) แล้วส่ง PR · **ห้าม commit ซอร์สที่ถอดแล้วลง repo นี้ (Public)** · ซอร์สในไฟล์เดียวต่อกัน คั่นด้วย `// ===== ชื่อไฟล์.gs =====` (ไฟล์ละบรรทัดเดียว บีบแล้ว) · เพิ่มฟีเจอร์ = เพิ่มไฟล์ใหม่ก่อน `zz_overrides.gs`
- ทดสอบฝั่งเซิร์ฟเวอร์ได้โดยไม่แตะระบบจริง: ใช้ `compileGas` + `createRuntime` จาก `server/runtime.js` กับ store จำลองในหน่วยความจำ (เซ็ตค่า `BOOK_core`/`BOOK_hr` ในprops, ชีตมี 2 แถวหัว: ป้ายชื่อ + คีย์ ข้อมูลเริ่มแถว 3)
- ตรวจหน้าจอ: PC 1440 · iPad 820 · iPhone 390 ทั้งหน้าหลังร้าน (`index.html`) และหน้าลงเวลา (`clock.html`) · บางหน้าจอแสดงสิทธิ์/เมนูไม่เหมือนกันตาม Role
- **สถานะ PR เก่า (ตรวจ 22 พ.ย. 2569 — ยังไม่ได้ merge/ปิดอะไร รอเจ้าของตัดสินใจ)**
  - #19 Finance ความปลอดภัยเคลียร์ค่าใช้จ่าย (draft): **main ทำครบแล้วทุกข้อ** (ยอดจ่าย/บัญชีคู่รายการ, migration RLS, Manager เห็น/เคลียร์ได้เฉพาะสาขา = `canSee`/`canManage` ใน `expense-clearances.ts`) — branch ล้าหลัง → ปิดได้ (ตรวจ 22 พ.ย. 2569 รอบสอง แก้ข้อสรุปเดิมที่ว่า "ส่วนสาขายังไม่เข้า" ซึ่งผิด)
  - #5 เครื่องมือ deploy/PWA อัปเดต: ซ้ำกับ `js/app-update.js` + `sw.js` ที่อยู่ใน main แล้ว และแก้ `sw.js` หนัก → น่าจะปิด
  - #1 (draft) Theme International: แก้ `index.html`/`clock.html`/`theme.js` ตรงๆ ขัดกติกา Theme แยกตาม Scope ผ่าน IT Control Center → น่าจะปิดหรือทำใหม่เป็นไฟล์ Theme ของตัวเอง
  - #3 telemetry Login/PIN: rebase แล้วเป็น **PR #39** (เก็บกติกาจอดับของ main + วัดขั้นตอนเข้าระบบ ไม่เก็บ PIN/token/ชื่อผู้ใช้) → ปิด #3 เมื่อ merge #39 · ต้องลองบนเครื่องจริงว่าไม่ช้าลง
  - #4 IT dashboard แท็บ + กระดิ่ง: rebase แล้วเป็น **PR #38** → ปิด #4 เมื่อ merge #38 · ระวัง: ป้ายปกติ/ผิดปกติตัดสินจากการค้นข้อความด้วย regex ตรวจกับของจริงก่อนเชื่อสี

## HR — ตำแหน่งงาน = แม่แบบสิทธิ์ (22 พ.ย. 2569 · Claude) — ต่อจากงาน GPT `ba83cce`/`0280330`
- **แนวคิด:** ตำแหน่ง (HR › Positions) กำหนด Role ของบัญชี + สิทธิ์เมนู + บทบาท Finance → เลือกตำแหน่งให้พนักงาน (HR › Employees) แล้ว Role พนักงาน / บัญชีผู้ใช้ที่ผูก (`empId`) / `finance.user_roles` ปรับตามเอง · แก้สิทธิ์ตำแหน่ง → ทุกคนในตำแหน่งเปลี่ยนตาม · ระบบออเดอร์ซิงก์ต่อจากสิทธิ์ `orders`/`catalog` (order-link)
- **หน้าเว็บ:** `js/hr-position-perms.js` (ไฟล์ใหม่ wrap `hrLoadPositions`/`openPosition`/`DB.upsertMany`/`userRow`/`openForm`) · หน้า Positions ภาษาไทย + ป้าย Role/สิทธิ์/Finance/จำนวนคน + รายชื่อพนักงานในตำแหน่ง · หน้า Users มีป้ายตำแหน่ง
  - ซิงก์เบื้องหลัง (เฉพาะคนที่มี `hr` / `users`): พนักงาน (ต้องมี `hr`), บัญชีผู้ใช้ (ต้องมี `users` — HR ไม่มีโดยค่าเริ่มต้น → ปรับให้เมื่อ Owner/Admin เปิดระบบ), Finance (ผ่าน API) · ชื่อผู้ใช้เดิมไม่เปลี่ยน · Owner/บัญชีหลัก ไม่ถูกปรับ · ตำแหน่งที่ไม่ตั้ง Role/สิทธิ์ = ไม่แตะสิทธิ์ใคร
  - `mod-hr.js`: เลิกล็อกการบันทึกพนักงานเมื่อโหลดตำแหน่งไม่สำเร็จ (ใช้รายการสำรอง)
- **API `hr-position-api` v5** (โค้ดอยู่ใน repo แล้ว `supabase/functions/hr-position-api/index.ts` · deploy แบบ jsDelivr ปัก SHA เหมือน finance-api):
  - แก้ 403 ของ Manager ที่มีสิทธิ์ `hr` · `save-template` (เก็บใน `it_position_permissions` app `cms` = `role:<r>`+สิทธิ์, app `finance` = `role:<r>`) · `sync-finance` (แตะเฉพาะแถว `granted_by='position:<code>'` — สิทธิ์ที่ Owner ตั้งเองใน Finance คงไว้; ไม่ปรับของตัวเอง)
  - กติกา: HR ให้สิทธิ์ได้ไม่เกินที่ตัวเองมี (คงของเดิมได้) · Role Admin = Owner/Admin · Finance ผู้อนุมัติ/ผู้ตรวจ/บัญชี = Owner เท่านั้น (HR ซิงก์บทบาทระดับนี้ไม่ได้)
- **ทดสอบ:** `tests/hr/` API 23/23 · UI 19/19 (PC / iPad / iPhone, Owner / HR / Manager+HR)
- **ฟอร์มพนักงาน (v1.0.1):** ช่องตำแหน่งอยู่ก่อน Role · ตำแหน่งที่ตั้ง Role ไว้ → Role ตั้งให้เองและล็อก · ตำแหน่งที่ยังไม่ตั้ง → เลือก Role เองได้ (มีข้อความบอก) · UI 23/23
- **งานถัดไป (สำหรับ AI ที่รับต่อ):**
  1. หลัง PR #33 merge: ลองจริงด้วยบัญชี Owner และ HR — ตั้งสิทธิ์ตำแหน่งที่ HR › Positions แล้วดูว่าบัญชีผู้ใช้/Finance ปรับตาม (ดู `finance.user_roles` ที่ `granted_by like 'position:%'`, ตาราง `it_position_permissions`)
  2. PR เก่าที่ยังเปิด (#19 ซ้ำกับงานที่ merge แล้ว, #5 #4 #3 #1) — ตรวจแล้วเสนอเจ้าของปิด/merge
  3. ถ้าแก้ `supabase/functions/*/index.ts` ต้อง push แล้ว deploy ใหม่ให้ชี้ SHA ใหม่ (ดูวิธีด้านบน) · ห้ามแตะ `server/gas.enc`, schema/Storage `backoffice`

## Finance — เบิก–เคลียร์ค่าใช้จ่าย ครบตามแผนภาพ (21 พ.ย. 2569 · Claude) — ใช้งานจริงแล้ว
- **Live:** Edge Function `finance-api` **v10 = โค้ดใน repo** (VERSION 1.3.0) · migration `finance_expense_flow_complete` apply แล้ว (สำเนา `supabase/migrations/20261121235000_finance_expense_flow_complete.sql`) — รวม PR #18/#19 ของ GPT
- **ขั้นตอน (เอกสารเดียวตลอดทาง):** Manager/Staff สร้างคำขอ + แนบใบเสนอราคา → ส่ง → Owner อนุมัติ/ตีกลับ (อนุมัติ = `approved` ยังไม่ลงบัญชี) → บันทึกจ่ายเงิน + แนบหลักฐาน + เคลียร์ (ค่าใช้จ่ายจริง/เงินคืน, บันทึกร่างได้) → ส่งเคลียร์ → Owner อนุมัติ/ส่งกลับ → ผู้ตรวจสุดท้าย ยืนยัน/ส่งกลับ → **ปิดงาน = ลงบัญชี + ภาษีซื้อ/หัก ณ ที่จ่าย** (เอกสาร `posted`) → รายงาน/แดชบอร์ดอัปเดตเอง
  - ผู้ตรวจส่งกลับแล้วยอดไม่เปลี่ยน → กลับไปผู้ตรวจเลย · ยอดเปลี่ยน → Owner ตรวจใหม่ · เคลียร์บางส่วน: VAT/WHT ตามสัดส่วน
  - SoD: ผู้สร้าง ผู้ส่งเคลียร์ Owner ผู้อนุมัติเคลียร์ เป็นผู้ตรวจสุดท้ายไม่ได้ · Manager เห็นเฉพาะสาขาตัวเอง (`public.staff.branch_id`)
- **API ใหม่:** `expense-flow`, `expense-flow-item`, `expense-clearance.verifier-return`, `expense-file.delete`, upload `expense-request.file.upload` (`expense-flow.ts`, `expense-clearances.ts`)
- **หน้าเว็บ:** เมนู "เบิก–เคลียร์ค่าใช้จ่าย" (`#fin/expflow`, `modules/finance/js/fin-pages-flow.js`, `css/fin-flow.css`) แท็บ ต้องทำ/กำลังดำเนินการ/ปิดแล้ว/ทั้งหมด · หน้ารายละเอียดมี stepper 6 ขั้น + ปุ่มตามบทบาท · `finance-embed.js` V 1.2.0
- **แก้บั๊ก live:** อัปโหลดหลักฐานเคลียร์ไม่ได้ (check `document_files`), Owner อนุมัติ/ผู้ตรวจยืนยันเคลียร์ error (check `approval_events.action`), ล้างข้อมูลทดสอบล้มเมื่อมีรายการเคลียร์, ชื่อไฟล์ภาษาไทยเพี้ยน, deep link `#fin/...` ค้างหน้า Today
- **ทดสอบ:** API E2E 178/178 · flow_ui 28/28 · ui 38/38 · embed 29/29 · live smoke 401 ไทย
- **ตั้งค่าก่อนใช้:** Finance › ตั้งค่า › ผู้ใช้งาน → กำหนด manager / staff / verifier (ผู้ตรวจต้องเป็นคนอื่น)
- **หนังสือรับรองหัก ณ ที่จ่าย 50 ทวิ (V 1.3.0 · API v11 / 1.4.0):** ตาราง `finance.wht_certificates` (migration `finance_wht_certificates`) ผูก `document_id` · เลขที่ `WTI-YYYYMM-0001` (document_sequences type `wht_certificate`)
  - API `wht-certificates.ts`: `wht-certificate-draft` (ดึงบริษัท/ผู้รับเงิน/ยอดจากคำขอ — เคลียร์บางส่วนคิดตามสัดส่วน), `wht-certificates`, `wht-certificate`, `wht-certificate.save` (สร้าง/แก้ — แก้ไม่ได้หลังปิดงาน), `wht-certificate.void`
  - หน้าเว็บ `fin-pages-wht.js` (`#fin/wht50/new:<คำขอ>` · `edit:<id>` · `<id>`): ฟอร์มตามแบบ + พิมพ์ A4 แนวนอน 2 ฉบับ (ฉบับที่ 1/2 ขนาด A5) ตามแบบกรมสรรพากร · ปุ่ม "บันทึก + สร้างหนังสือหัก ณ ที่จ่าย" ในฟอร์มขอเบิก · ส่วน "หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)" ในหน้าคำขอ (พิมพ์/ดู/แก้/ยกเลิก) · `FIN.load(key)` โหลดไฟล์หน้าล่วงหน้า
  - ทดสอบ: API 193/193 · wht_ui 19/19 · embed 34/34 · flow_ui 28/28 · ui 38/38
- **เปลี่ยนหน้า Finance ลื่น (V 1.2.2):** `fin-core.go` วาดแต่ละหน้าลงกล่องใหม่ `.fm-host` — หน้าเดิมแสดงจาง (`#fmContent.fm-busy`) จนหน้าใหม่พร้อม (เกิน 0.7 วิ ค่อยแสดงสถานะโหลด) · แก้บั๊กตัวดักคลิกของหน้า (เบิก–เคลียร์/ตรวจเอกสาร/ผู้ใช้/ผังบัญชี) ซ้อนบน `#fmContent` จนกดครั้งเดียวยิง API หลายรอบ
- **เมนู Finance บนมือถือไม่ครบ/เกิน (V 1.3.3):** เมนูบนสุดของมือถือวาดก่อนรู้บทบาท แล้วไม่วาดใหม่ → Owner ไม่เห็น อนุมัติและตรวจสอบ/ผู้ใช้งาน/ตั้งค่าระบบ · Manager/Staff เห็นกลุ่มที่เข้าไม่ได้ · แก้: `mnav()` วาดใหม่ทุกครั้งใน `decorate()` (ชุดเดียวกับแถบซ้าย PC/iPad) · embed 40/40
- **เมนู Finance บนมือถือ (V 1.3.2):** ลูกศรกลุ่มเมนูค้างชี้ขึ้นทุกกลุ่ม (CSS ของ `.fin-mnav summary` ไหลไปโดนกลุ่มย่อย → ใช้ `>`) · หน้าหลังร้านวาดใหม่แล้วเมนู/กลุ่มที่กางไว้ไม่หุบเอง · embed 37/37
- **หน้าอนุมัติแยกหน้าที่ผู้เบิก/ผู้อนุมัติ (V 1.3.1 · API v12):** Owner/ผู้อนุมัติ เห็นเฉพาะ "อนุมัติคำขอเบิก" / "ส่งกลับให้แก้" ในคำขอของคนอื่น — ไม่เห็น ส่งขออนุมัติ/แก้ไข/แนบไฟล์/ส่งเคลียร์/สร้าง 50 ทวิ และ API ปฏิเสธ (403) ด้วย (`canManage` ใน `expense-clearances.ts`, `documents.ts` update/submit, `expense-flow.ts` mine) · แท็บ "ต้องทำ" ไม่โชว์ร่างของคนอื่น · Owner ยังยกเลิกเอกสาร/50 ทวิ ได้ · ทดสอบ API 201/201 · flow_ui 31/31
  - **วิธี deploy `finance-api` ตั้งแต่ v12:** ฟังก์ชันเป็น `index.ts` บรรทัดเดียว import `supabase/functions/finance-api/index.ts` ผ่าน jsDelivr **ปักที่ commit SHA** (เหมือน backoffice) — v12 ชี้ `76700e3` · แก้ไฟล์ .ts แล้ว push → deploy ใหม่ให้ชี้ SHA ใหม่ ไม่งั้นไม่มีผล
- **กดเมนูย่อย Finance ไม่ refresh ทั้งหน้าแล้ว** (`finance-embed.js` V 1.2.1): ย้ายหน้า `#fin/a → #fin/b` ข้าม `App.render` ของหลังร้าน เปลี่ยนเฉพาะเนื้อหา Finance (`FIN.go`) · กลุ่มเมนูที่กางไว้ไม่หุบ · ไม่แก้ `app.js`

## Finance & Accounting (21 พ.ย. 2569 — Claude, branch `feature/finance-module-foundation`, PR #6) — merge เข้า main แล้ว 21 พ.ย. 2569 16:3x (`63669a0`) หน้า Finance ขึ้นจริงแล้ว
- **API จริง:** Edge Function `finance-api` (v5, `verify_jwt=false`) โค้ด `supabase/functions/finance-api/*.ts` · schema `finance` · migration `finance_operational_v1` (สำเนา `supabase/migrations/202611210004_*.sql`)
  - ยืนยันตัวตนด้วย CMS session เดิม: เรียก `backoffice?action=me&t=<token>` (แคช 30 วิ) → ไม่สร้าง login ใหม่ · CMS Owner = Finance owner อัตโนมัติ
  - สิทธิ์: owner / approver / accountant / viewer (หน้า "ผู้ใช้") · Maker–Checker: คนสร้างอนุมัติเองไม่ได้ (ยกเว้น owner เปิด `allow_self_approval` สำหรับทดสอบคนเดียว — บันทึก audit แยก)
  - อนุมัติเอกสาร = ลงบัญชีอัตโนมัติ (สมดุล, VAT/WHT เข้า tax_transactions) · จ่าย/รับเงิน pending→approved→paid · งวดบัญชี ปิด/เปิดใหม่ (ต้องใส่เหตุผล) · ยื่น ภ.พ.30 / ภ.ง.ด.3 / 53 · รายงาน TB, P&L, งบดุล, แยกประเภท, อายุหนี้
  - ข้อมูลที่ลงบัญชีแล้วแก้/ลบไม่ได้ (trigger `guard_locked_transition`) — แก้ด้วยการกลับรายการเท่านั้น
- **หน้าเว็บ (21 พ.ย. 16:5x):** Finance อยู่ **ในหน้าจัดการร้าน (index.html)** ไม่ใช่หน้าแยก — `js/finance-embed.js` (defMod `fin`, กลุ่มเมนู Finance)
  - แถบซ้าย: เมนูหลัก "Finance & Accounting" กดแล้วเมนูย่อยลงมา (21 รายการ) · มือถือ: "เมนู Finance" พับได้บนสุดของหน้า · เส้นทาง `#fin/<หน้า>`
  - หน้าย่อยมาจาก `modules/finance/js/fin-*.js` (fin-core มีโหมดฝัง `window.FIN_EMBED`) · CSS `modules/finance/css/fin-embed.css` (สร้างจาก finance.css + fin-ui.css ด้วย `tests/finance/build-embed-css.cjs` ครอบ `.fin-embed` — อย่าแก้ตรง)
  - พื้นที่แสดงผลคงอยู่เมื่อหน้าหลังร้านวาดใหม่ (live.js) ฟอร์มที่กรอกไม่หาย · `finance.html` เปิดตรง → พาไป `index.html#fin/…` (`?standalone=1` = หน้าแยกไว้ทดสอบ)
  - แอป Owner หน้าแรกกลับเป็น 2 ปุ่ม (ตัดปุ่ม Finance ที่ GPT เพิ่ม) · การ์ด Finance ใน "ระบบเข้าร้าน" ชี้ `index.html?from=owner#fin`
- **ทดสอบ:** API E2E 112/112, UI E2E 37/37 (PC+iPhone, หน้าแยก), ฝังในหลังร้าน `embed.py` 29/29 (`tests/finance/e2e/`, รันด้วย Deno+Postgres+mock CMS ในเครื่อง) · Live smoke: ไม่มี token/token ผิด → 401 ข้อความไทย, origin แปลก → 403
- **เริ่มใช้งานจริง:** บริษัทใน DB ตอนนี้ `environment='uat'` ชื่อ "Café Amazon – CMS Finance Test Workspace" → ตอนเปิดร้าน: หน้า ตั้งค่า > ล้างข้อมูลทดสอบ (`purge_company_transactions`, เฉพาะ uat) → แก้ชื่อบริษัท/เลขภาษี → กด "เริ่มใช้งานจริง" (`go_live`, ย้อนกลับไม่ได้)
- ค้าง/ข้อควรระวัง: ฟังก์ชันเก่า `supabase/functions/finance` ไม่ได้แตะ (ไม่มีหน้าไหนเรียกแล้ว)

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

### แอปได้เวอร์ชันใหม่ทันทีหลัง deploy (21 พ.ย. 2569 · Claude)
- สาเหตุที่แอปช้าสุดหลัง deploy: GitHub Pages ให้เบราว์เซอร์จำไฟล์ 10 นาที (`max-age=600`) และแอปที่เปิดค้าง (สลับแอปไปมา) ไม่โหลดหน้าใหม่เอง · ของเดิม (GPT 19 พ.ย.) แค่เปลี่ยนชื่อ cache ใน `sw.js` ไม่ได้แก้ต้นเหตุ
- `sw.js` (`amz-app-v4`): หน้า html ขอเซิร์ฟเวอร์ทุกครั้งด้วย `cache:'no-cache'` (เช็ค ETag ได้ 304) · ไฟล์ js/css ที่มี `?v=` ใช้ที่จำไว้ทันที (เปิดเร็วขึ้น) + โหลดใหม่เบื้องหลังกันลืมเปลี่ยนเลข · เก็บแต่ละไฟล์รุ่นล่าสุดรุ่นเดียว
- `js/app-update.js` (ใหม่ · โหลดใน `index.html`, `owner.html`, `clock.html` ต่อจาก `pwa.js`): กลับมาที่แอป (ซ่อน ≥ 30 วิ) หรือทุก 10 นาที → เทียบ `?v=` ใน html ล่าสุดกับที่โหลดอยู่ ต่างกัน = แถบ "มีเวอร์ชันใหม่ · แตะเพื่ออัปเดต" (ไม่รีโหลดเอง กันข้อมูลที่กรอกค้างหาย) + สั่ง `sw.js` ตรวจรุ่นใหม่
- **กติกา: แก้ js/css ต้องเพิ่ม `?v=` เสมอ** — แถบอัปเดตอาศัยเลขนี้ตัดสินว่ามีเวอร์ชันใหม่
- ทดสอบ PC + iPhone (จำลอง) 16/16: แก้ html เปิดใหม่ได้ทันที, เปลี่ยน `?v=` → มีแถบ → แตะแล้วได้ไฟล์ใหม่, ไม่เปลี่ยน → ไม่มีแถบ · ชุดเดิมผ่านครบ (fold 18, scope 18, owner lock 27+4)

## ค้าง / รอเจ้าของ
- ~~อีเมล (Resend)~~ **เลิกใช้แล้ว (22 พ.ย. 2569)** — ไม่มีโดเมนส่งอีเมล เข้าระบบครั้งแรก = รหัสเปิดใช้งานที่ Owner/HR ออกให้ · ลืม PIN = รับรหัสทาง LINE (ดูหัวข้อด้านล่าง) · ข้อ IT `auth_mail` ตอนนี้เป็นข้อความแจ้งเฉยๆ ไม่เตือนแล้ว
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
- Scope review รอบสอง: เทียบกับ `js/app-lock.js` พบว่า Staff/Manager lock มี guard `fromOwner`; เพิ่ม `ownerContext()` ใน `js/owner-pwa-lock.js` ให้ทำงานเฉพาะ `owner.html` หรือ Back Office ที่เปิดจาก Owner และจำกัด `renderLogin` wrapper ด้วย `fromOwner()` เพื่อไม่ให้ PWA พนักงาน/Manager ที่เปิดตรงได้รับ Owner PIN prompt
- Cache version ล่าสุด `owner-pwa-lock.js?v=2.1.3` ทั้ง `owner.html` และ `index.html`
- Commits: `df2181a` (Owner PWA lock), `90bd7a0` (Owner Console session handling), `d5ecd06` (scope guard Owner context), `ce3b8c7` (`owner.html` cache-bust), `6778080` (`index.html` cache-bust), `5d9840f` (IT report update), `983a45d` (IT report initial)
- ขอบเขต: Front-end เท่านั้น ไม่แก้ Edge Function หรือ `server/gas.enc`; ยังต้องทดสอบบน iPhone/Android จริงก่อนปิดงาน

## HR Documents + Birthdays + Advanced IT Monitor (19 พ.ย. 2569)
- HR Employees: เพิ่มวันเกิดวันนี้/พรุ่งนี้ใต้รายชื่อ โดยกรองเฉพาะพนักงาน active ตาม scope/branch ที่ผู้ใช้เห็น (js/mod-hr.js)
- HR Employee Documents: เพิ่มแผงเอกสารรายบุคคล PDF/JPG/PNG/WEBP ไม่เกิน 20MB; category Resume, ID card, Education, Contract, Bank, Medical, Social Security, PDPA, Other (js/hr-documents.js)
- เอกสารเก็บใน Private Storage bucket hr-employee-documents, Signed URL อายุ 5 นาที; Edge Function hr-documents ตรวจ CMS session ผ่าน Back Office bootstrap, permission hr/Owner และ branch scope ก่อนอ่าน/เพิ่ม/ดู/ลบ; log upload/view/delete
- DB migration: public.hr_employee_documents, public.hr_employee_document_audit; RLS enabled; revoke client privileges (anon, authenticated); service_role only
- Owner > ระบบ IT: js/it-ai.js + js/owner.js เพิ่ม Diagnostic Engine v1 วิเคราะห์ it/status, it/perf, it/events, it/dash(days=7); Risk Score/anomaly rules และ refresh ทุก 5 นาทีขณะเปิดหน้า IT
- หมายเหตุ: IT Monitor v1 เป็น rule-based diagnostic ไม่ใช่ Generative AI/ChatGPT; ยังไม่มี LLM provider/API key
- ไม่แก้ server/gas.enc, Back Office v10, Branch/Employee master, Staff/Manager App Lock, LINE/LIFF/Clock, Line-Order
- Migration applied; RLS/privileges verified; JavaScript syntax passed; Edge Function hr-documents ACTIVE v1
- ยังต้องทดสอบ end-to-end ด้วย HR account จริง, PDF/รูปภาพ upload-preview-delete, branch isolation, iPhone/Android และ refresh monitor 5 นาที
- รายงาน IT: docs/IT-REPORT-HR-DOCUMENTS-AND-AI.md
- Commits: 1ee228c (birthdays), a8481a6 (document UI), bec3f35 (register HR module), ceafff8 (document service), 6dba685 (secure URL/bucket lazy check), 0c0d9a4 (URL parser fix), 60a57ff (scope formats), 0b28b5d (transactional metadata/audit), bc8f4b5 (single auth check preview), 9436cbf (IT diagnostic engine), 12f2da3 + 2846692 (IT integration), 6c0609e (Owner script), b64d349 (IT report), d3a0299 (report update)

### Always-on IT Background Monitor (19 พ.ย. 2569)
- เพิ่ม Edge Function `it-monitor` ACTIVE v1 และ pg_cron job `it-monitor-every-5-minutes` job_id=2 schedule `*/5 * * * *` active=true — ตรวจต่อเนื่องทุก 5 นาทีแม้ Owner ปิดหน้า IT/ปิดอุปกรณ์
- ใช้ `CRON_KEY` ที่มีอยู่ใน backoffice.kv; internal cron endpoint validates key; GET/manual run validates CMS Owner session
- ตาราง `public.it_monitor_runs` เก็บ Risk Score, Findings, Metrics 90 วัน; RLS on, anon/authenticated privileges revoked, service_role only; advisory lock ป้องกัน job ซ้อน
- ตรวจ Supabase heartbeat, Order heartbeat, Back Office Cron, Cron failures, outbox errors, Order Sync errors, SSO failures, orders 24h/stale >90m, active branches, HR private bucket readiness
- Owner > ระบบ IT อ่านผลล่าสุดจาก server และปุ่ม `ตรวจระบบเดี๋ยวนี้` สั่ง run ทันที; in-page browser perf/events/incident drilldown ยังคงทำงานเพิ่มเมื่อเปิดหน้า IT
- ทดสอบ manual cron endpoint ด้วย pg_net ได้ HTTP 200; snapshot แรก healthy / Risk 100; job ตรวจทุก 5 นาทีตั้ง active แล้ว
- ข้อจำกัด: monitor ตรวจเฉพาะ backend/database telemetry; ไม่อาจตรวจ UI บนอุปกรณ์ที่ปิดอยู่. Engine เป็น rule-based diagnostic ไม่ใช่ LLM
- Files: `supabase/functions/it-monitor/index.ts`, `js/it-ai.js`, `js/owner.js`, `owner.html`; report: `docs/IT-REPORT-HR-DOCUMENTS-AND-AI.md`
- Commits: `12c3069` (monitor service), `dc931a1`/`be48f15` (background UI), `402fe3a` (manual run), `70e33f8` (cache bust), `e9ed458` (report)


### HR Documents Directory tab (19 พ.ย. 2569)
- เพิ่มแท็บ `Documents` ใน HR navigation ต่อจาก Employees และ Recruitment (`#hr/docs`)
- หน้าแรกแสดงรายชื่อพนักงานในขอบเขตสาขาที่ผู้ใช้มีสิทธิ์; กดชื่อเพื่อดูเอกสารของพนักงานคนนั้น
- รายการเอกสารเรียงตาม `created_at` จากใหม่ไปเก่า (อัปโหลดล่าสุดอยู่ด้านบน); View ใช้ signed URL อายุ 5 นาทีเหมือนเดิม
- ปุ่ม `จัดการ / เพิ่มเอกสาร` เปิด Employee form เดิมซึ่งมีส่วนอัปโหลดเอกสารอยู่แล้ว; ไม่เปลี่ยน schema/API/ระบบอื่น
- Files: `js/mod-hr.js`, `js/hr-documents.js`, `index.html` (cache bust `mod-hr 4.5.5`, `hr-documents 1.1.0`)
- Commits: `db0bc09` (directory/viewer), `ff2ac4b` (HR tab), `8759026` (asset cache bust)
- ยังต้องทดสอบด้วยบัญชี HR/Owner จริงและตรวจสิทธิ์ข้ามสาขาใน production หลัง deployment; การตรวจในรอบนี้ยืนยันว่า code changes อยู่บน `main` เท่านั้น


### HR Documents Failed to fetch / CORS fix (19 พ.ย. 2569)
- ตรวจ Supabase Edge Logs พบ `OPTIONS | 403` สำหรับ `hr-documents?action=list` ใน Function v5 ก่อน request GET จะถูกส่ง ทำให้ browser แสดง `Failed to fetch`
- สาเหตุ: CORS allowlist มีเฉพาะ `https://centralized-store-management.github.io` แต่หน้าที่ใช้งานจริงเปิดจาก `https://centralized-store-management-system.github.io`
- เพิ่ม allowlist ให้รองรับทั้งสอง exact origins; ไม่ใช้ wildcard
- Deploy `hr-documents` ACTIVE v6; source mirror `supabase/functions/hr-documents/index.ts` commit `390f36a`
- ยืนยันจาก Supabase Function metadata ว่า v6 ACTIVE และ allowlist มีทั้งสอง origins; ต้อง reload หน้า HR เพื่อให้เกิด request ใหม่และยืนยัน end-to-end จาก browser


### Owner Console: dedicated AI Monitoring Advanced menu (19 พ.ย. 2569)
- ก่อนแก้ Advanced panel ถูกฝังไว้ท้ายหน้า `ตรวจ & ซ่อมอัตโนมัติ` เท่านั้น จึงไม่ปรากฏเป็นเมนูแยกใน sidebar ตามที่ผู้ใช้คาดหวัง
- เพิ่ม nav route `#ai` และเมนู `AI Monitoring · Advanced` ภายใต้ `2. Super Advance IT` แยกจาก `ตรวจ & ซ่อมอัตโนมัติ`
- หน้า Advanced ดึง 4 แหล่งเดิม: IT Status, Performance, Event History และ Incident Dashboard 7 วัน; แสดงผลจาก `ocAiPanelHtml()` เดิมและ Background IT Monitor
- เปิดหน้า AI แล้วตั้ง refresh ทุก 5 นาที; ออกจากหน้าจะ clear timer ตามกลไก `ocGo()` เดิม. Server-side pg_cron monitor ยังคงทำงานทุก 5 นาทีโดยไม่ขึ้นกับหน้าเว็บ
- เอา AI panel ออกจากหน้า `ตรวจ & ซ่อมอัตโนมัติ` เพื่อลดความซ้ำซ้อน; ไม่แตะระบบซ่อม/คำสั่ง heal และไม่แก้ Edge Function เดิม
- Files: `js/owner.js`, `owner.html` (cache bust owner.js 4.9.3)
- Commit: `258cb16` (dedicated route), `77eebce` (asset cache bust)


### HR Document upload 500 correction (19 พ.ย. 2569)
- ตรวจ Supabase logs: CORS ผ่านแล้ว (OPTIONS 200, GET list 200) แต่ POST upload ตอบ 500 เพราะ `ensurePrivateBucket()` ตรวจ storage bucket ที่ยังไม่มีอยู่ และ Storage API ตอบ HTTP 400 พร้อม `NoSuchBucket` แทน 404
- ปรับ `supabase/functions/hr-documents/index.ts` ให้ตรวจ `NoSuchBucket` response และสร้าง bucket ได้อย่างถูกต้อง; deploy Edge Function `hr-documents` ACTIVE v7 (ไม่แก้ backoffice v10)
- สร้าง bucket `hr-employee-documents` ผ่าน migration `20261119150233_create_private_hr_employee_documents_bucket`; ยืนยัน DB แล้วว่า `public=false`, size limit 20MB, MIME จำกัด PDF/JPG/PNG/WEBP
- GitHub: function fix commit `87c3ef5`; migration mirror commit ด้านล่าง
- ยังไม่ทดสอบไฟล์จริง end-to-end หลัง deployment; ให้ผู้ใช้ลอง upload ใหม่แล้วตรวจ POST result/storage object/metadata row ใน logs ก่อนปิดงาน


### IT Monitor CORS + diagnostic severity tuning; HR Documents row actions (19 พ.ย. 2569)
- ตรวจ screenshot/production logs: `it-monitor` browser preflight OPTIONS ถูก 403 เพราะ allowlist เดิมมีเพียง `centralized-store-management.github.io`; เพิ่ม exact origin `https://centralized-store-management-system.github.io` โดยไม่เปิด wildcard และ deploy `it-monitor` ACTIVE v2. Cron endpoint ยังคง POST 200 ตามรอบทุก 5 นาที
- ปรับ `js/it-ai.js`: isolated/small sample failures ไม่ถูกจัดเป็นระบบผิดปกติระดับ bad อีกต่อไป; classify as warning. Critical คงไว้เมื่อ P95 >=15s, max >=30s หรือ failure count >=5 และเท่ากับ/มากกว่าจำนวน sample; 8s/15s latency เป็น warning
- HR Documents directory: filename กดเพื่อ View ได้ทันที; แสดงปุ่ม View | ลบ ในแถวรายการ; ลบผ่าน authenticated `hr-documents` API และ update list หลัง success
- Cache bust: `owner.html` it-ai 1.0.2; `index.html` hr-documents 1.1.1
- Verified JS source syntax for `it-ai.js`, `hr-documents.js`, `owner.js`; verified `it-monitor` ACTIVE v2; verified document bucket private; DB check found 2 active doc rows and both have matching Storage objects (no filename/employee PII printed). Function logs show upload POST 200, document listing GET 200, and view GET 200
- Commits: monitor CORS `2b7cd1b`; AI thresholds `515799f`; HR row actions `d66030a`; cache bust `c04ebbb` + `e481111`

- ปรับ KPI counts ให้สรุปจำนวน Finding ระดับ critical/warning ตามรายการวิเคราะห์จริง รวม performance warnings ด้วย; commit `288fc37`, Owner cache bust `it-ai.js?v=1.0.3`.


## IT Control Center — Phase A isolation (20 Nov 2026)
- Added `css/owner-theme.css` as a dedicated Owner visual stylesheet, copied from the current prototype theme to preserve the existing Owner appearance at the point of separation.
- `owner.html` now loads `css/owner-theme.css?v=1.0.0` and declares `data-app="owner"`.
- `index.html`, `clock.html`, and `line.html` now declare `data-app="backoffice"`, `staff`, and `line` respectively.
- Back Office and Staff continue to load `css/prototype-theme.css`; Owner no longer loads that shared stylesheet. Future Owner Theme changes must be made only in `css/owner-theme.css`.
- This is asset isolation only. No authentication, permissions, business logic, feature flags, or production lock controls were changed. Device-specific PC/Mobile/iPad previews and secure server-side IT Control Center controls remain pending.


## IT Control Center Phase B/C/D (20 Nov 2026)
- Phase B: Owner Theme rollout scopes separated for PC/Mobile/iPad web and installed Mobile/iPad app; Owner theme enabled in 5 scopes. Added device preview selector (responsive-size mock, not physical-device capture).
- Phase C: Added `public.it_control_settings` and `public.it_control_audit` with RLS enabled and anon/authenticated direct privileges revoked. Added `it-control-center` Edge Function v1 (ACTIVE); requires valid CMS Owner session via Back Office bootstrap for reads/writes. 16 scopes seeded across Owner, Back Office, Staff, LINE and Registration.
- Phase D: Authentication policy draft stored independently per scope. `auth_enforcement_enabled=false` for all scopes; no existing login, Authenticator, Owner PIN, Staff App Lock, or LINE login behavior changed.
- Verification query: 16 scopes total; 5 Owner Theme scopes ON; 11 non-Owner scopes rollout-locked; 0 auth enforcement enabled.
- Pending QA: live authenticated Owner GET/POST, audit log end-to-end, physical device visual review, browser regression. Do not enable auth enforcement or unlock non-Owner rollout until QA and explicit approval.


## Staff Theme isolation / restore (20 พ.ย. 2569)
- เจ้าของยืนยันให้ Staff กลับไปใช้ Theme เดิมทั้งหมด จนกว่าจะเปิดระบบ Theme ใหม่หรืออนุมัติรูปแบบแยกตามอุปกรณ์
- แก้ `clock.html`: ถอด `css/prototype-theme.css?v=1.7.0` ออกจากหน้า Staff Time Clock; คง `css/app.css` และ `css/theme-b.css` ตามเดิม เพื่อให้ระบบใช้ Theme เดิม/ค่ารูปแบบเดิมที่ตั้งไว้
- ครอบคลุมหน้า Staff Time Clock ที่เปิดผ่าน PC, Mobile Web, iPhone/Android PWA และ iPad Web/PWA เพราะทั้งหมดใช้ `clock.html` และ responsive layout ชุดเดียวกัน
- ไม่แก้ `index.html` / Back Office Theme, `owner.html` / Owner Theme, JavaScript, Login, สิทธิ์, API, ข้อมูล หรือ workflow
- ยังไม่เปลี่ยน Theme ภายในหน้าที่ Staff เปิดผ่าน Back Office (`index.html`); การแก้ครั้งนี้จำกัดเฉพาะ Staff Time Clock/PWA เพื่อไม่กระทบ Back Office ทั้งระบบ
- Commit: `d39c8d739390a10c7517ee5a60eacdc31f45c348`
- หลัง deploy ให้ทดสอบ PC, iPhone/Android PWA และ iPad; บนเครื่องที่ติดตั้งแอปอาจต้องปิด/เปิดแอปใหม่ขณะออนไลน์เพื่อดึง HTML เวอร์ชันล่าสุด


## IT Control Center — ใช้งานจริง: Theme แยกตาม Scope (20 พ.ย. 2569 · Claude)
- **ปัญหาเดิม:** ตาราง `it_control_settings` เป็นแค่บันทึก ไม่มีหน้าไหนอ่าน · Theme ยังเขียนตายตัวใน html (`prototype-theme.css` + `module-headers.css` ใน index.html ใช้กับทุกคนที่เปิดหลังร้าน) → แก้ของ Owner ทีไรกระทบทุกระบบ
- **ตอนนี้:** `js/app-scope.js` (โหลดใน `<head>` ของ owner/index/clock แทน `<link>` Theme เดิม) หา Scope ของเครื่อง = ระบบ × ช่องทาง (web / installed_app / line_liff) × อุปกรณ์ (pc / mobile / ipad) แล้วโหลด CSS ตามที่ตั้งใน IT Control Center
  - Theme เป็น "ชุด" (`theme_package`): `classic` (ไม่มี) · `prototype` (prototype-theme + module-headers) · `owner` (owner-theme) — รายการไฟล์อยู่ที่ `THEMES` ใน `js/app-scope.js` ที่เดียว (**ห้ามใส่ `<link>` Theme ตรงใน html อีก** · bump `?v=` ของ CSS Theme ที่ไฟล์นี้)
  - จำค่าไว้ใน localStorage `amz.itcc.pub.v1` (ไม่กระพริบ) · ไม่มีเน็ต/ครั้งแรก ใช้ค่าตั้งต้น = หน้าตาเดิม · โหลดค่าใหม่หลังหน้าเสร็จ + ทุกครั้งที่กลับเข้าแอป
  - Scope ใหม่ `backoffice_owner_web` / `backoffice_owner_app` = หน้าจัดการร้านที่เปิดจากแอป Owner (`from=owner`) → ตั้ง Theme ให้ Owner ได้โดยไม่กระทบพนักงาน
- DB: migration `it_control_theme_package_and_owner_handoff` (คอลัมน์ `theme_package` + 2 scope ใหม่ · ค่าเริ่มต้นตรงกับหน้าตาปัจจุบัน: Owner=owner, หลังร้าน=prototype, Staff/LINE/ลงทะเบียน=classic)
- Edge Function `it-control-center` **v2** (ต้นฉบับ `supabase/functions/it-control-center/index.ts`): `GET ?public=1` ไม่ต้องเข้าระบบ คืนเฉพาะค่า Theme · POST รับ `theme_package` · Scope ที่ล็อกเปลี่ยน Theme ไม่ได้ (409) · Owner เท่านั้นที่แก้ได้ + Audit Log
- หน้า Owner > ระบบ IT > IT Control Center: ทุกแถวมี เลือก Theme / เปิด-ปิด / ล็อก-ปลดล็อก แยกกัน · แสดงว่า "เครื่องนี้" อยู่ Scope ไหน
- ทดสอบ (Chromium จำลอง PC / iPhone / แอปที่ติดตั้ง): 18 ข้อผ่าน — ค่าตั้งต้นและลำดับ CSS เหมือนเดิมทุกหน้า, เปลี่ยน Scope หนึ่งไม่กระทบ Scope อื่น · Owner lock ชุดเดิม 27+4 ข้อผ่าน — **ยังไม่ได้ทดสอบบนเครื่องจริง**
- สถานะ Phase: A เสร็จ · B (แยก Scope + ตั้งค่า) ใช้งานได้จริงแล้ว · C (เก็บค่า/Audit บนเซิร์ฟเวอร์) ใช้งานจริง · D (Authentication Policy) ยังเป็น Draft ไม่บังคับใช้ — ตั้งใจไม่ผูก Login กับค่าที่แก้ผ่านเว็บจนกว่าจะอนุมัติ
- ยังไม่ครอบคลุม: `line.html` (LINE) ไม่โหลดตัวเลือก (ต้องเบา) · ฟีเจอร์/JS เฉพาะระบบ (ยังแยกด้วยโค้ด เช่น owner-pwa-lock ตรวจ owner context)
- Commits: `64dfdd8` (ตัวเลือก Theme + หน้าตั้งค่า + function source) และ commit นี้ (HANDOFF)

### หัวหน้ามือถือ + Approvals ล้นจอ (20 พ.ย. 2569 · Claude)
- ปัญหา: บนมือถือ หลังร้านแสดงทั้งแถบหัว (topbar) และการ์ดหัวใหญ่ (`.mhead`) ซ้ำกัน ชื่อเมนูติดกับคำอธิบาย ปฏิทินซ้ำ 2 ที่ · รูปประกอบหัวอยู่ใต้ปฏิทิน/ปุ่ม/ไอคอน · Approvals แถว "มีกะตามตาราง แต่ไม่พบการลงเวลา" ปุ่ม 5 ปุ่มล้นจอเลื่อนไม่ได้ · การ์ด "รออนุมัติ" ตัวหนังสือชิดขอบ
- แก้ (ไม่แตะ CSS ที่ใช้ร่วม): `css/prototype-fix.css` (ใหม่ · อยู่ในชุด Theme `prototype` ใน `js/app-scope.js`) — มือถือ <960px ใช้แถบหัวอย่างเดียวตามแบบเดิมของระบบ, รูปประกอบแสดงเฉพาะหัวที่ด้านขวาว่าง, ไอคอนขาวชัด, ปฏิทินเป็นเม็ดยาไม่ล้น, `.sumbox` มีระยะขอบ · จอ PC ไม่เปลี่ยน
- `css/mobile-fix.css` (ใหม่ · ลิงก์ใน index.html เป็นการจัดวาง ไม่ใช่ Theme): แถวที่มีปุ่ม ≥3 ปุ่ม บนจอ ≤680px ปุ่มขึ้นบรรทัดใต้ชื่อและตัดบรรทัดได้
- ตรวจด้วย Chromium จำลอง iPhone 13 / iPhone SE / PC ครบ 16 เมนู: ไม่มีส่วนหัวทับกัน ไม่มีหน้าล้นแนวนอน · PC ยังแสดงการ์ดหัวใหญ่เหมือนเดิม — ยังไม่ได้ดูบน iPhone จริง


### Super Advance IT — AI Operations Copilot Phase 1 (20 พ.ย. 2569)
- ตรวจระบบจริงก่อนต่อยอด: Supabase project ytxbnqosenolojifeikf ACTIVE_HEALTHY; it-monitor ACTIVE v2; it-monitor-every-5-minutes ทำงานทุก 5 นาทีอยู่แล้ว; Diagnostic Engine ปัจจุบันเป็น rule-based ไม่ใช่ LLM
- เพิ่ม AI Operations Copilot ในหน้า AI Monitoring: คำถามภาษาไทย + prompt shortcuts + คำตอบจาก OpenAI Responses API โดยใช้เฉพาะ health metrics / findings ที่ผ่าน whitelist; ไม่ส่งชื่อพนักงาน ลูกค้า หรือข้อความ LINE
- เพิ่ม Edge Function it-ai-ops: ตรวจ CMS Owner session ผ่าน Back Office bootstrap, CORS allowlist แบบ exact origins, จำกัดคำถาม 1,500 ตัวอักษร, context whitelist, timeout 30 วินาที, store=false, ไม่เปิด tool calling และไม่ execute คำสั่ง/แก้ production
- โหมดเริ่มต้น Read-only เท่านั้น; ระบบ monitor เดิมยังคงตรวจทุก 5 นาทีโดยไม่เปลี่ยน Cron หรือ Edge Function เดิม
- ต้องตั้ง Supabase Edge Function Secret OPENAI_API_KEY ก่อน AI Chat ใช้งานได้; ตั้ง OPENAI_MODEL ได้ (default gpt-6.2-astra). API usage/billing แยกจาก ChatGPT subscription
- ยังไม่ตั้ง secret และยังไม่ทดสอบ AI response จริง; หลังตั้ง secret ต้องทดสอบด้วยบัญชี Owner และตรวจ provider quota/model access ก่อนเปิดใช้
- Files: js/it-ops.js (ใหม่), supabase/functions/it-ai-ops/index.ts (ใหม่), js/owner.js, owner.html, css/owner.css
- Safety backlog: เพิ่ม durable audit/approval queue, action allowlist และ rollback verification ก่อนเปิด automatic remediation; ห้ามให้ AI execute SQL, change RLS/Auth, delete data หรือ deploy production เอง

- Post-deploy verification: client JS syntax ผ่าน; Owner JS syntax ผ่าน; Edge Function it-ai-ops ACTIVE v2; monitor cron เดิมยัง Active ที่ */5 * * * *; owner.html cache-bust owner.js 4.9.6 / owner.css 4.8.4 / it-ops.js 1.0.0
- หมายเหตุทดสอบ: ยังไม่สามารถทดสอบ AI provider response ได้จนกว่าจะตั้ง OPENAI_API_KEY; deployment สำเร็จไม่ได้แปลว่า AI chat พร้อมใช้งานทันที

### Super Advance IT — Phase 2 Observe-only Automation (20 Nov 2026)
- Added database tables: public.it_ops_incidents, public.it_ops_action_queue, public.it_ops_audit. RLS enabled; direct anon/authenticated table privileges revoked; service_role only. No public Data API grant.
- Deployed Edge Function it-ops-orchestrator v2. Uses existing backoffice CRON_KEY for scheduled invocation and existing Owner bootstrap session for read/approve/reject. It consumes latest it_monitor_runs, deduplicates incidents by fingerprint and monitor run, creates safe investigation proposals, and writes audit trail.
- Added Cron job it-ops-orchestrator-every-5-minutes (jobid 3, */5 * * * *) alongside existing it-monitor-every-5-minutes (jobid 2); existing monitor job unchanged.
- Added Incident & Approval Center to AI Operations Copilot. Owner can view recent incidents and approve/reject investigation plans. Approval only records human approval; it does NOT execute an action.
- Verified orchestrator v1 manually through pg_net HTTP response 200 and audit row: monitorRunId 302, findings 0, proposals 0, mode observe_only. Function subsequently updated to v2 for idempotent per-monitor-run counting and ALL_CLEAR filtering; scheduled deployment now v2.
- No automated remediation, DB writes from AI, resend/retry, cron restarts, permission changes, RLS changes, or deployments are enabled. All production-changing operations remain manual.
- AI model API key remains separate prerequisite for AI narrative analysis; scheduled deterministic triage does not depend on OpenAI key.
- Frontend versions: owner.js 4.9.6; owner.css 4.8.5; it-ops.js 1.1.0.
- Current health snapshot at test: latest monitor run had zero findings, so empty incident/approval queues are expected.
- Next Phase 2.1: after Owner UI verification, add explicit per-action allowlist, timeouts, cooldowns, rollback checks and an isolated dry-run executor; only then consider low-risk automatic remediation. No automatic repair until these controls and owner policy are tested.

### Super Advance IT — Phase 2.1 Controlled Dry-run (20 Nov 2026)
- Added `public.it_ops_action_runs` to record read-only dry-run simulations. RLS enabled; anon/authenticated privileges revoked; service_role only.
- Upgraded Edge Function `it-ops-orchestrator` to v3 (ACTIVE). Added exact action allowlist for dry-run, Owner session validation, approved-status requirement, approval expiry check, 30-minute cooldown per queue item, preflight evidence, simulation result and rollback-readiness metadata.
- Dry-run actions only read aggregated/system-health data: Outbox error counts by kind (no recipient/body), Cron job state/history, and latest IT Monitor metrics. No mail resend, cron enable/restart, order sync/retry, status edits, permissions changes, deploys, or production remediation.
- GET response now includes action-run history. Owner UI now shows approved items and a "ทดสอบ Dry-run" button only for allowlisted actions; pending approvals still require Owner decision.
- Frontend `js/it-ops.js` bumped to v1.2.0; `owner.html` references CSS v4.8.6. JavaScript syntax check passed.
- Verified `it-ops-orchestrator` deployed ACTIVE v3; Cron jobs `it-monitor-every-5-minutes` and `it-ops-orchestrator-every-5-minutes` remain active at 5-minute intervals. Database permissions check: RLS on; anon/authenticated SELECT denied; service_role SELECT allowed for all four ops tables.
- Current observed Outbox state: 1 mail error in last 24 hours. Current Monitor run had findings `OUTBOX_ERRORS` and `MAIL_NOT_CONFIGURED`. This should be investigated; no retry was performed.
- Supabase security advisors still report pre-existing broader project notices (RLS-enabled/no-policy tables, pg_net in public schema, one SECURITY DEFINER RPC, and leaked-password protection disabled). No unrelated security settings were changed in this phase.
- Phase 2.1 is a controlled dry-run only. No production-changing action executor is enabled. Next gate: test an actual Owner-approved dry-run from mobile/desktop Owner UI, then design a separately reviewed remediation adapter with tested rollback before enabling any automatic repair.

- Phase 2.1 follow-up verification fix: `it_monitor_runs.findings` and `metrics` are returned by the Postgres driver as JSON strings in this project. Orchestrator v4 now safely parses JSONB strings before triage/dry-run; without this fix, Monitor findings would have been incorrectly treated as empty. Next scheduled 5-minute cycle should now create the OUTBOX_ERRORS incident and Owner approval proposal from the live finding.

- Post-v4 deployment snapshot: Monitor run 303 contains `OUTBOX_ERRORS` + `MAIL_NOT_CONFIGURED`; the most recent orchestrator request visible in `net._http_response` was still the pre-v4 cycle (run 302), so the new JSONB parser has not yet been observed processing run 303. At snapshot time, incidents=0, pending approvals=0, dry-run records=0. Verify after the next scheduled orchestrator tick before considering Phase 2.1 end-to-end tested.

### Super Advance IT — Phase 2.2 Root Cause & Predictive Signals (20 Nov 2026)
- Added `public.it_ops_metric_history` and `public.it_ops_diagnostics` with RLS enabled; anon/authenticated privileges revoked; service_role only.
- Deployed `it-ops-orchestrator` v5 (ACTIVE). Each monitor cycle stores one deduplicated metric snapshot, derives evidence-based root-cause hypotheses from known finding codes, compares six system metrics against the previous five samples, and records low-confidence baseline signals. No production changes are executed.
- Owner GET response now includes latest diagnostic history and metric history. Owner Console shows Root Cause hypotheses, evidence, recommended verification steps, metric direction and forecast caveats.
- Verified manual scheduled invocation returned HTTP 200 for monitor run 304: 2 findings, 2 incidents updated, 0 new proposals (idempotent proposal keys), root-cause hypotheses for OUTBOX_ERRORS and MAIL_NOT_CONFIGURED; metrics show outbox errors stable at 1, stale orders 0, Supabase/Order heartbeats current, sync errors 0, SSO failures 0. Trend currently has only 2 samples and is explicitly marked baseline/low confidence; this is not statistical prediction.
- UI JavaScript syntax passed; UI parses JSONB arrays whether returned as native arrays or serialized JSON strings.
- Both Cron jobs remain active at */5 * * * *. Security verification: new diagnostic/history tables have RLS enabled; anon and authenticated SELECT denied; service_role SELECT allowed.
- Existing issue remains: 1 Outbox error in 24h and mail provider is not configured (MAIL_NOT_CONFIGURED). No resend or secret changes performed.
- Phase 2.2 is deployed and the first end-to-end diagnostic run succeeded. Next: collect a longer metric window (at least 24h / 288 five-minute samples) before fitting any meaningful forecast; consider AI-assisted diagnosis only after OPENAI_API_KEY and model configuration are confirmed. No autonomous remediation is enabled.


## Super Advance IT — Phase 2.3 (2026-11-20)

- Added isolated tables: `it_ops_anomaly_events`, `it_ops_dependency_map`, `it_ops_learning_feedback`. RLS enabled; anon/authenticated have no table privileges; service_role has access.
- Seeded 7 curated dependency relationships spanning Owner Console, Backoffice, Supabase, IT Monitor, IT Orchestrator, AI context, Mail provider, and Order pipeline.
- Deployed `it-ops-orchestrator` version 6. It now performs read-only anomaly checks for outbox errors, stale orders, order sync/SSO errors, and heartbeat age. Count-based anomaly checks require at least 5 prior samples and use a median baseline; heartbeat age has a fixed 10-minute threshold. Anomaly records are upserted and auto-resolved when readings return within thresholds. No remediation is triggered.
- Added Owner-only learning feedback POST with validated feedback types and audit logging. Feedback is stored for evaluation only; it does not train a model or alter thresholds automatically.
- GET response now exposes anomaly events, dependency map, and feedback history to the existing Owner UI.
- Owner UI adds Anomaly Detection, dependency map, and feedback controls. Asset versions: `it-ops.js?v=2.3.0`, `owner.css?v=4.8.8`.
- Verified JavaScript syntax with `new Function`. Manually invoked Cron endpoint: HTTP 200, monitor run 305, 2 findings, 2 incident upserts, 1 proposal, no anomalies detected. Existing Outbox issue and missing mail-provider configuration remain unresolved.
- Metric history is only 3 samples as of this deployment. Count-based anomaly detection remains in warm-up until 5 prior samples are available; no statistical forecasting or autonomous recovery is enabled.
- Production safety: no business/order/customer data was modified; no secrets, Cron schedules, authentication policies, or remediation actions changed.
- Commits: UI `28676ad34d41c830accc0c97e7ebaf17342b6af8`; Owner asset versions `82eb5b8418d5ac3ef22f4f6f108080e88b298cff`, `8802bfa3d01a6f9d93a3f0484d237d06951f324d`; CSS `0439b95453107dbc67d75ac42ccc7453cda98a51`.


## Phase 2.4–2.9 Production Foundation (20 พ.ย. 2569)
- Applied additive Supabase migration `it_ops_phases_24_29_foundation` to project `ytxbnqosenolojifeikf`.
- Added six tables: `it_ops_recovery_plans`, `it_ops_alerts`, `it_ops_notification_deliveries`, `it_ops_governance`, `it_ops_integration_test_runs`, `it_ops_forecast_snapshots`.
- Enabled RLS on all six tables; revoked client privileges from anon/authenticated; granted service_role.
- Added indexes for alert status, recovery plan status, notification delivery lookup, and integration test history.
- Seeded governance controls with safe defaults: autonomous remediation OFF, email notifications OFF, LINE notifications OFF, production-write stress tests OFF.
- Verified all six tables exist with RLS enabled.
- Verified both existing cron jobs remain active at */5 * * * *.
- Scope delivered: production database foundation only. Phase 2.4–2.9 application workflows, Owner UI, alert dispatch integrations, forecast engine, recovery execution, and end-to-end/stress testing are NOT complete yet. Existing orchestrator function was intentionally not replaced in this migration because current deployed implementation and repository source need reconciliation before a safe production function deployment.
- No production business/order/customer data changed; no cron schedules or secrets changed; no autonomous remediation enabled.

## ตรวจงาน GPT + แก้ 6 จุด (21 พ.ย. 2569 · Claude)
ตรวจ 78 commit ของ GPT (48ee867 → 6bb1cca) — แก้แล้ว:
1. **IT Ops Control Center ตอบ 500 ทุกครั้ง** (`URL is not a constructor`): `supabase/functions/it-ops-control-center` ตั้งตัวแปรชื่อ `URL` ทับ `new URL()` → เปลี่ยนเป็น `SUPABASE_URL` · deploy v5 · **อย่าตั้งชื่อตัวแปรทับของระบบ (URL, Request, Response, fetch)**
2. **หลังร้านมือถือ: เมนูล่างบังปุ่มในป๊อปอัปทุกอัน** — Theme Prototype/Owner ตั้ง `.bottom{z-index:50}` สูงกว่า `.scrim{z-index:20}` → `css/mobile-fix.css` ตั้ง `.scrim{z-index:60}` · เพิ่ม fixed element ใหม่ให้ต่ำกว่า 60 ถ้าไม่ใช่ป๊อปอัป
3. **Mgr/Staff ตั้งรหัสแอปบนหน้าหลังร้านไม่ได้** (`C is not defined`) — `js/app-lock.js` อ้าง `C` ที่มีเฉพาะ clock → ตรวจ `typeof C` ก่อน · เครื่องที่ผูกค้างจากช่วงพัง ลบได้ที่ ระบบ IT > วิธีเข้าระบบ
4. **`owner.html` มี `\n` ตัวอักษรจริง 2 จุด** (หลุดขึ้นจอ + CSS/สคริปต์ไปอยู่ใน body) → แก้เป็นขึ้นบรรทัดจริง
5. **IT Ops เสนองานตรวจซ้ำทุก 5 นาที** (95 รายการใน 11 ชม.) — `it-ops-orchestrator` v10: เสนอ 1 รายการต่อ incident+งาน ถ้ายังมีรายการรออนุมัติ/อนุมัติแล้วที่ยังไม่หมดอายุ · รายการซ้ำเดิม 47 รายการเปลี่ยนเป็น `expired` (ไม่ลบ)
   - **ไฟล์ใน repo เดิมเก่ากว่าที่ deploy** (ขาด anomaly/learning feedback) — ตอนนี้ `supabase/functions/it-ops-orchestrator/index.ts` = ตัวที่ deploy จริง · **deploy แล้วต้อง commit ต้นฉบับทุกครั้ง**
6. **ข้อมูล IT Ops ไม่มีการลบของเก่า** (~1.4 MB/วัน) — migration `it_ops_dedupe_queue_and_retention`: `private.it_ops_prune()` + pg_cron `it-ops-prune-daily` 03:23 น.: ผลตรวจ/diagnostics/metric 90 วัน, คิวที่จบแล้ว 90 วัน, anomaly ที่ปิดแล้ว 90 วัน, audit 365 วัน
- เพิ่ม: IT Ops ไม่เก็บอีเมล Owner ลง audit แล้ว (ใช้ username)
- ไม่แก้ตามเจ้าของสั่ง: #7 ผู้ช่วย AI (`it-ai-ops`) พักไว้ — ต้องซื้อ API ก่อน · #8 toast กลางจอทุกแอป — เจ้าของยืนยันให้คงไว้
- ทดสอบ: Owner lock 27/27 + 4/4, Theme scope 18/18, ชุดแก้ใหม่ 5/5, ฟังก์ชัน IT Ops ทดสอบด้วย stub (เดิม 500 → 200, dedupe ถูก) — ยังไม่ได้ลองกดหน้า IT Ops ด้วย session Owner จริง
- ยังค้าง (เล็ก): Line-Order มีไฟล์ทดลองค้างบนเว็บ (`sw.js`, `manifest.webmanifest` ไม่มีใครใช้, `international-sidebar-prototype.html`, `native-app/` GPS) · `it-dialog.js` ไม่ล้างตัวดักคีย์บอร์ดเมื่อปิดด้วยคลิก

### แอป IT: ย่อหัวข้อ + สถานะ + กระดิ่ง (21 พ.ย. 2569 · Claude)
- `js/owner-fold.js` (ใหม่ · โหลดท้าย `owner.html`): ทุกหน้าของ Owner Console ย่อหัวข้อไว้ก่อน แตะเพื่อขยาย — หัวข้อ `h3.h3` + เนื้อหาถัดไป และการ์ดที่มีหัวข้อในตัว (`section.group.pad` ที่มี `.h2`, `.oc-ops-panel`, การ์ดใน IT Control Center)
  - หัวข้อแสดง `ผิดปกติ N · ควรดู N · ปกติ N` (นับแถวละ 1 สถานะจาก `.oc-dot`/`.chip`) · มีผิดปกติ/ควรดู → กระดิ่ง 🔔 สั่น · เมนู "ตรวจ/ซ่อม" มีกระดิ่ง+จำนวน (จาก `OC.status`)
  - จำหัวข้อที่เปิดไว้ใน sessionStorage `ocf.open.v1` (คีย์ = หน้า + คำแรกของหัวข้อ) · ปุ่มขยาย/ย่อทั้งหมด · ส่วนสรุปบนสุด (hero/คะแนน/ปุ่มเครื่องมือ) ไม่ย่อ
  - ไม่แก้โค้ดหน้าเดิม: จัดรูปหลังวาดเสร็จด้วย MutationObserver — **ถ้าเพิ่มหัวข้อใหม่ ใช้ `<h3 class="h3">` หรือการ์ด `section.group.pad > .h2` จะได้ย่อ/นับสถานะอัตโนมัติ**
- ทดสอบ PC + iPhone (จำลอง) 18/18: หน้า IT สูงจาก ~3,800px เหลือ ~1,700px ตอนย่อ, ปุ่มในเนื้อหา/กราฟยังทำงาน
- ปรับรอบ 2 (ตามเจ้าของ): **หน้าแดชบอร์ดไม่ย่อ** (`SKIP.dash`) · กระดิ่งเป็นไอคอนเส้น (SVG) ในวงกลมสีอ่อน + จุดสี (เหลือง=ควรดู, แดง=ผิดปกติ) · หัวข้อเป็นการ์ดของตัวเอง ขยายแล้วการ์ดเนื้อหาเดิมต่อด้านล่าง (ไม่ซ้อนการ์ด) · มือถือสถานะอยู่บรรทัดเดียวกับหัวข้อถ้าพอ
  - บั๊กที่แก้: คลาส `ocf-b` ชนกับป้ายสถานะ ทำให้การ์ดใน AI Monitoring กว้างเกินจอ → ใช้ `ocf-card` / `ocf-inner`
  - IT Control Center: แถว Theme บนมือถือ ปุ่มกินที่จนชื่อแถวเหลือคำละบรรทัด (จากปุ่มที่เพิ่มเมื่อ 20 พ.ย.) → จอ ≤640px ปุ่มลงบรรทัดใต้ชื่อ
- ปรับรอบ 3 (21 พ.ย. · `owner-fold.js?v=1.2.0`): กระดิ่งไปติดปุ่ม "ตรวจใหม่" (ใช้ `data-oc="it"` เหมือนเมนู) → ใส่เฉพาะเมนู (`:not(.btn):not(.oc-card)`) · การ์ดหัวข้อใหญ่ขึ้นแบบการ์ด AI Monitoring + ไอคอนสถานะซ้าย (✓ / ! / ×) + บรรทัดสรุป `.ocf-sub`: ชื่อรายการที่ผิดปกติ/ควรดู (สูงสุด 2 + "และอีก N") · มีปัญหารายการเดียวแสดงรายละเอียดสั้นด้วย · ปกติหมด = "ตรวจ N รายการ · ปกติทั้งหมด"
- รอบ 4 (`owner-fold.js?v=1.2.2`): IT Control Center การ์ด **Theme Rollout** + **Owner Theme Preview** ย่อ/ขยายพร้อมกัน (`GROUPS` → `data-grp`, คีย์จำสถานะร่วม `<view>:grp:theme`) · Authentication Policy = ร่างข้อความเท่านั้น (`auth_profile` ใน `it_control_settings`) ไม่มีโค้ดไหนอ่านไปใช้ ไม่มีผลกับการเข้าระบบจริง (วิธีเข้าระบบจริงอยู่หน้า "เข้าระบบ")
- รอบ 5 (`owner-fold.js?v=1.3.0`): **Incident & Approval Center** แยกออกจากการ์ด AI Copilot เป็นการ์ดของตัวเองใต้ Copilot (`SOLO` ย้าย `#oc-ops-queue` ออกมา · id เดิม `it-ops.js` วาด/รีเฟรชได้ตามเดิม) ย่อไว้ก่อน · หัวการ์ดอ่านจาก `.oc-ops-queue-summary`: ป้าย "เหตุการณ์เปิด N / รออนุมัติ M" + กระดิ่ง · บรรทัดสรุป = ชื่อแผนที่รออนุมัติ
- **คะแนน System Health 84** (เจ้าของถามว่าผิดปกติไหม): สูตร `42_SuperIT.gs` = 100 − ผิดปกติ×15 − ควรดู×4 → ควรดู 4 รายการ (ตาราง `IT สรุปรายวัน` 21 พ.ย.):
  1) ส่งอีเมล — ยังไม่ตั้ง `RESEND_API_KEY` · 2) เซิร์ฟเวอร์ Supabase — ส่งออก mail ล้มเพราะคีย์เดียวกัน → **ข้อ 1–2 หายเมื่อเจ้าของตั้ง Resend secret**
  3) "ระบบเกิดข้อผิดพลาด 4 ครั้ง (7 วัน)" — error เก่าสมัย Google (MailApp/liffInfo_ 14–15 พ.ย.) หลุดช่วง 7 วันเองราว 22–23 พ.ย.
  4) "คำสั่งที่ช้า: delta 30 วิ (หน้าเว็บ)" — **ไม่ใช่ระบบช้า**: มือถือจอดับระหว่างรอ เวลาที่วัดได้ = timeout · แก้ `js/it-rum.js?v=4.5.5` ไม่นับคำสั่งที่ระหว่างรอหน้าถูกซ่อน (จอดับ/สลับแอป)


## Finance CMS — Manager / Staff + Final Verification (21 พ.ย. 2569 · branch `feat/finance-manager-final-verification`)
- **สถานะ branch ล่าสุด:** `59d53b521e4e7e24edd49e615ba492083b4cde3b` · ahead `main` 41 commits · behind 0 · ยังไม่ merge เข้า main
- Workflow: Manager/Staff สร้างคำขอ → Owner อนุมัติเอกสารรายจ่าย → Manager/Staff สร้างรายการจ่ายที่เชื่อมเอกสาร (ระบบส่งสถานะเป็น approved พร้อมบันทึกผู้อนุมัติเดิม) → ดำเนินการจ่ายเงินจริง → แนบหลักฐานใน private Storage → Final Verifier ตรวจและยืนยันความครบถ้วน
- Role codes: `manager`, `staff`, `verifier` ถูกเพิ่มใน schema/API และหน้าจัดการผู้ใช้; **ยังไม่มีการมอบสิทธิ์ให้ผู้ใช้จริงโดยอัตโนมัติ** เจ้าของระบบต้องกำหนดจาก CMS users
- Manager/Staff ได้สิทธิ์สร้างคำขอและบันทึกการจ่ายหลังอนุมัติ แต่ไม่มีสิทธิ์อนุมัติเอกสารหรือยืนยันเอกสารขั้นสุดท้าย
- Final Verifier มีสิทธิ์ดูคิวตรวจเอกสาร/เปิด signed URL และยืนยันเอกสารเท่านั้น ไม่มีสิทธิ์อนุมัติ จ่ายเงิน หรือแก้ยอดเงิน
- **Segregation of Duties:** ผู้สร้างรายการ, ผู้อนุมัติ และผู้บันทึกการจ่าย ห้ามเป็นผู้ตรวจเอกสารขั้นสุดท้ายของรายการเดียวกัน; API ตรวจ actor ทั้งสามและปฏิเสธเมื่อซ้ำกัน (403) · ตรวจซ้ำรายการที่ Verified แล้วจะถูกปฏิเสธ (409)
- หลักฐานจัดเก็บใน private Storage bucket จำกัดชนิดไฟล์ PDF/JPG/PNG/WEBP ขนาดไม่เกิน 20 MB; หลัง Verified แล้วห้ามแนบ/เปลี่ยนหลักฐานผ่าน workflow นี้
- E2E เพิ่มกรณี Manager/Staff/Verifier, multipart upload และ mock private Storage; **ยังไม่ได้ยืนยันผลรันชุด E2E ในรอบนี้ และยังต้องเพิ่มกรณีทดสอบ SoD actor ซ้ำโดยตรง**
- Migration `202611210006_finance_manager_final_verification.sql` เป็น additive; **ยังไม่ apply กับ Supabase และยังไม่ deploy Edge Function** · ห้ามนำขึ้น Production ก่อนรัน migration + E2E + UAT และตรวจ regression ของ CMS login/Finance roles
- Commits ล่าสุดที่รับเข้าประวัติ: `033ecb3` (SoD final verifier), `dd6a68b` (ส่งต่อ Owner approval ไปยัง disbursement ที่ผูกกับเอกสาร), `59d53b5` (เพิ่ม E2E ตรวจการอนุมัติ Owner ก่อนจ่าย)

## สิทธิ์ตามตำแหน่ง (รวม Finance) ที่ Settings › Permissions
- `js/perms-positions.js` (ใหม่, โหลดหลัง `hr-position-perms.js`): ตารางตำแหน่ง → Role หลังร้าน · บทบาท Finance · จำนวนเมนู · ปุ่มแก้ไข (เปิดฟอร์มตำแหน่งเดิม)
- ฟอร์มพนักงาน: ใต้ช่อง Role แสดงบทบาท Finance ตามตำแหน่ง (อ่านอย่างเดียว) — Role ในฟอร์มคือสิทธิ์หลังร้าน (Staff/Manager/HR/Owner) บทบาท Finance (ผู้อนุมัติ/ผู้ตรวจสุดท้าย/บัญชี) ตั้งที่ตำแหน่งเท่านั้น
- `hr-position-perms.js` เปิด `window.PosPerms` (อ่านอย่างเดียว) ให้ไฟล์ใหม่ใช้
- ตัวเลือก Owner ในฟอร์มพนักงานแสดงเฉพาะ Owner อยู่แล้ว (`ROLE_OPTS` ใน mod-hr.js); ยังไม่ได้ตรวจว่าเซิร์ฟเวอร์กันซ้ำ

## HR → Users → รหัสเปิดใช้งาน → ตารางงาน (ซิงก์ให้ต่อกัน)
สาเหตุที่เจอ: (1) สร้างบัญชีให้เฉพาะตอนเพิ่มพนักงานครั้งแรก เปลี่ยน Role ทีหลัง (เช่น Owner → Staff) ไม่สร้าง (2) บัญชีที่สร้างอัตโนมัติไม่มีรหัสเปิดใช้งาน เจ้าตัวเข้าไม่ได้ (3) หน้า Users ไม่บอกว่าใครยังไม่มีรหัส (4) ตารางงานแสดง Manager/Staff ทุกตำแหน่ง
- เซิร์ฟเวอร์ `62_HrAccess.gs` (ซอร์สใน CMS-server-src): บันทึกพนักงานทุกครั้ง → สร้างบัญชีที่ขาด (ยกเว้น Role Owner / ลาออก / ใช้ PIN เดิมของ HR) · ธง `noCode` ในรายการ users · op `hrEmpAccess` (สร้างบัญชี + ออกรหัส; Owner/Admin ทุกคน, HR เฉพาะ Staff/Manager ที่ยังไม่ตั้ง PIN ในสาขาที่ดูแล) · op `hrSyncUsers` (Owner/Admin) · `PUBLIC_SETTINGS` เพิ่ม `noSchedPos`
- `js/hr-access.js`: เพิ่มพนักงานใหม่ → ขึ้นรหัสเปิดใช้งานทันที · หน้า Users แผง "ต้องทำต่อ" (ออกรหัส / สร้างบัญชี + ออกรหัส / สร้างให้ทุกคน)
- `js/sched-positions.js` + คอลัมน์ "จัดตารางงาน" ที่ Settings › Permissions: ตำแหน่งที่เอาติ๊กออกไม่ขึ้นในตารางงาน (เก็บที่ `settings.noSchedPos`; คนที่มีกะ/รูปแบบกะอยู่แล้วยังแสดง)
- แก้บั๊กปุ่ม "แก้ไข" ในตารางสิทธิ์ตามตำแหน่ง: ACT ถูกคัดลอกตอน `defMod` — action ที่เพิ่มทีหลังต้องใส่ `ACT` เองด้วย
- Role Owner ของพนักงานใน HR (เช่น Final Verifier E004) สร้างบัญชีเองไม่ได้โดยตั้งใจ — ต้องตั้ง Role เป็น Manager/Staff ก่อน
- ทดสอบ: `tests/hr-access.test.mjs` (server) ใน CMS-server-src
- **ลงทะเบียนผ่าน LINE ยังใช้ได้ตามเดิม** (`19_LineReg.gs` + `44_OneReg.gs`) และไม่ชนกับการสร้างบัญชีอัตโนมัติ: `regCore_` เรียก `upsertMany_` ภายในเซิร์ฟเวอร์ ซึ่งไม่ผ่าน `hrUserSyncAfter_` จึงไม่สร้างบัญชีซ้ำ · คนที่ HR ออกรหัสไว้แล้วแต่ไปลงทะเบียน LINE จะได้ PIN จากการ์ด LINE แทน และรหัสเปิดใช้งานเดิมถูกล้างทิ้ง (ใช้ไม่ได้อีก) · คนที่ตั้ง PIN แล้ว ลงทะเบียน LINE ไม่เปลี่ยน PIN
- ปุ่ม "ออกรหัส" ในแผงต้องทำต่อ ใช้ `hrEmpAccess` (ไม่ใช่ `resetUserPin`) สำหรับบัญชีที่ผูกพนักงาน เพื่อให้เซิร์ฟเวอร์ปฏิเสธถ้าเจ้าตัวเพิ่งตั้ง PIN เอง แล้วโหลดข้อมูลใหม่ · บัญชีที่ไม่ผูกพนักงานยังใช้ `resetUserPin`
- ทดสอบเพิ่ม: `tests/line-reg.test.mjs` (25 ข้อ) ใน CMS-server-src
- แก้ตาราง "สิทธิ์ตามตำแหน่ง" ค้างที่ "กำลังโหลด": หน้า Settings › Permissions สั่ง `hrLoadPositions()` เองแล้ว (เดิมต้องเปิด HR › Positions ก่อน) · ไม่ใช้ `PosPerms.ready()` ซึ่งบังคับว่าต้องมีตำแหน่งที่ตั้งสิทธิ์แล้วอย่างน้อย 1 รายการ · โหลดไม่สำเร็จมีปุ่ม "ลองใหม่"
- ตรวจการลบแล้ว: ลบพนักงาน → `afterRemoveLink_` (46_ITLinks.gs) ลบบัญชีผู้ใช้ที่ผูกไว้ให้ด้วย · ลบพนักงานที่มีประวัติเวลา/เงินเดือนไม่ได้ (ให้เปลี่ยนเป็น "ลาออก" ซึ่งปิดบัญชีให้เอง) · "ลบถาวร" (45_ITPurge.gs) ลบ PIN/LINE/Authenticator และตัด session

## Role ใหม่: Final Verifier (verifier) + สิทธิ์เมนูตามตำแหน่งในหน้า Permissions
- เซิร์ฟเวอร์ `63_RoleVerifier.gs`: `ROLES.verifier`, `ROLE_PREFIX.verifier='fv_'`, `DEFAULT_PERMS.verifier=['approve_time','approve_stock','time','schedule_view']`, `ORDER_ROLE.verifier='manager'` (Line-Order), `HR_PREFIXES` เพิ่ม `fv_`, override `scopeFor_` → เห็นทุกสาขา, ข้อตรวจ IT `role_verifier`
- หน้าเว็บ `js/role-verifier.js`: `ROLE_NAME`/`UPREFIX`/`DEFAULT_PERMS`/`PERM_ROLES` + override `savePerms` (ของเดิมฮาร์ดโค้ด 4 ระดับ จะตกระดับใหม่) + เพิ่มตัวเลือกในช่อง Role ของฟอร์มพนักงานและฟอร์มผู้ใช้ + เติมหัวคอลัมน์และแถวขอบเขตสาขาในตารางสิทธิ์
- **ค่าเริ่มต้นสิทธิ์ของ verifier ต้องตรงกันทั้ง 2 ไฟล์เสมอ** (กติกาเดียวกับ mod-settings.js)
- `js/hr-position-perms.js`: `EMP_ROLES` / `ROLE_TH` / ตัวเลือกใน `openPosition` เพิ่ม verifier (ตำแหน่งตั้ง Role นี้ให้พนักงานได้)
- `js/perms-positions.js`: ตารางที่ 2 "สิทธิ์เมนูตามตำแหน่ง" (แถว = เมนู, คอลัมน์ = ตำแหน่ง) บันทึกผ่าน `save-template` เฉพาะตำแหน่งที่เปลี่ยน และคง Role/บทบาท Finance ของตำแหน่งไว้
- ทดสอบ: `tests/role-verifier.test.mjs` (22 ข้อ) + หน้าเว็บ PC/iPad/iPhone 24 ข้อ

## ผลตรวจทั้งระบบ 22 พ.ย. 2569 13:35
**ปกติดี** — gas.enc บน main ตรงกับซอร์สใน CMS-server-src · ไม่มี action/op ที่หน้าเว็บเรียกแล้วเซิร์ฟเวอร์ไม่มี · ค่าเริ่มต้นสิทธิ์เว็บ = เซิร์ฟเวอร์ ทุกระดับรวม verifier · cron 4 งานสำเร็จหมด ไม่ล้มเหลวใน 24 ชม. · ซิงก์ Line-Order ไม่มี error · พนักงาน 3 ↔ บัญชีผู้ใช้ 3 ↔ staff 4 (รวม owner) ครบ ไม่มีบัญชีกำพร้า · สาขา CMS 1 ↔ Line-Order 1

**แก้แล้วใน PR นี้** — เลข `?v=` ไม่ตรงกันข้ามหน้า (`app-scope` 1.0.1/1.0.2, `toast-ux` 4.5.4/4.5.5, `order-link` 4.8.5/4.7.0 → เสี่ยงบางหน้าใช้ไฟล์เก่าจากแคช) · ลบ `js/email-otp.js` ที่ไม่มีใครโหลดแล้ว

**ยังค้าง รอเจ้าของตัดสินใจ**
1. **ตำแหน่งผูกด้วยชื่อ ไม่ใช่ id** — พนักงานทั้ง 3 คนมี `positionId` ว่าง มีแต่ `position="บาริสต้า"` · `posOfEmp` จึงต้องเทียบด้วยชื่อ ถ้าเปลี่ยนชื่อตำแหน่งใน Positions สิทธิ์/Role ตามตำแหน่งจะหลุดเงียบๆ (คนที่บันทึกใหม่หลังจากนี้ได้ `positionId` แล้ว) → ควร backfill ครั้งเดียว
2. **ตำแหน่งไม่ซิงก์ไป Line-Order** — `order-link.js` ซิงก์ชื่อ/Role/สาขา แต่ไม่ซิงก์ `staff.position_id` · ตอนนี้ Pae = ผู้จัดการร้าน ใน Line-Order แต่ CMS = บาริสต้า, Don/JJ เป็น null
3. **iam_sync_outbox ไม่มีตัวประมวลผล** — `hr-position-api` เขียน event อย่างเดียว (มี 1 รายการค้าง pending ตั้งแต่ 11:59) และ `iam_principal_role_grants` = 0 ทั้งที่ `iam_position_role_bindings` มี 2 → ระบบ IAM ต่อไม่ครบ ยังไม่กระทบการใช้งาน
4. **แจ้งเตือนซ้ำที่ auto-heal แก้ไม่หาย** — "คำสั่งช้า delta → อุ่นแคชทั้งหมด (แก้อัตโนมัติ 3 ครั้งแล้วยังเกิดซ้ำ)" 13:20
5. **เรื่องอีเมลค้างเป็น incident เปิดอยู่** — `it_ops_incidents` id 2 "ยังไม่ได้ตั้งค่าระบบอีเมล" + `SUPA_IT.lastErr` = RESEND_API_KEY · เลิกใช้อีเมลแล้ว (61_LineReset) ควรปิดหรือซ่อนข้อตรวจนี้
6. **PR เก่าค้าง 5 รายการ** — #3 และ #4 ถูกแทนที่ด้วย #39/#38 ที่ merge แล้ว · #19 ถูกแทนที่ · #5 ซ้ำกับระบบอัปเดตที่มีอยู่ · #1 ขัดกติกา Theme แยก Scope

## แก้ 6 เรื่องที่ค้างจากผลตรวจ (22 พ.ย. 2569 บ่าย)
1. **ตำแหน่งผูกด้วยรหัสแล้ว** — ต้นเหตุจริง: คอลัมน์ `positionId` / `positionCode` มีอยู่ในแผ่นพนักงาน แต่ **ไม่เคยประกาศใน `TABLES`** เซิร์ฟเวอร์จึงทิ้งค่าที่หน้าเว็บส่งมาทุกครั้ง · แก้ที่ `66_PositionId.gs` (ประกาศคอลัมน์ + ข้อตรวจ IT `pos_link`) และ `js/pos-id-fix.js` (เติมรหัสอัตโนมัติทุกครั้งที่บันทึก + ปุ่ม "ซ่อมการเชื่อมตำแหน่ง" สำหรับข้อมูลเก่า)
2. **ตำแหน่งซิงก์ไป Line-Order** — `64_OrderPosition.gs` ส่ง `position` / `positionCode` / `positionId` ไปกับ roster · `server/order-link.js` แปลงเป็น `hr_positions.id` แล้วเขียน `staff.position_id` (หาไม่เจอ = คงค่าเดิม ไม่ล้างทิ้ง) · **ต้อง deploy ฟังก์ชัน `backoffice` ให้ชี้ SHA ใหม่**
3. **IAM outbox** — ไม่มีตัวรับจริง (hr-position-api เขียนอย่างเดียว) จึงทำให้ "เห็น" แทนการซ่อน: หน้า Settings › Permissions แสดงจำนวนที่ค้างพร้อมบอกว่ายังไม่มีระบบปลายทาง ถ้าไม่ต่อระบบอื่นก็ปล่อยไว้ได้
4. **แจ้งเตือน delta ช้าซ้ำ** — ต้นเหตุ: `it-rum.js` ส่งเวลาที่วัดจาก**เบราว์เซอร์ผู้ใช้** (รวมเน็ต) เข้าถังเดียวกับเวลา**ฝั่งเซิร์ฟเวอร์** ข้อตรวจจึงเห็นเป็นวินาทีแล้วสั่ง "อุ่นแคช" ซึ่งแก้ไม่ได้ → เตือนวนไม่จบ · ข้อมูลจริง: delta ฝั่งเซิร์ฟเวอร์ = 2 มิลลิวินาที, ฝั่งเบราว์เซอร์ 0.9–9 วินาที · แก้ที่ `65_PerfSplit.gs` แยกเป็นคนละข้อ (ฝั่งผู้ใช้ไม่มีปุ่มแก้อัตโนมัติ เกณฑ์ 8 วิ) และเปลี่ยนป้าย "Google" เป็น "เซิร์ฟเวอร์"
5. **อีเมล** — ตัดข้อตรวจ `MAIL_NOT_CONFIGURED` ออกจาก `supabase/functions/it-monitor/index.ts` (ระบบเลิกใช้อีเมลแล้ว) · it-ops-orchestrator จะปิด incident เองเมื่อไม่เห็น finding นี้อีก · **ต้อง deploy ฟังก์ชัน `it-monitor`**
6. PR เก่า #1 #3 #4 #5 #19 ปิดแล้ว พร้อมเหตุผลในแต่ละอัน

## Deploy ฟังก์ชัน (22 พ.ย. 2569 14:00)
- `backoffice` version 14 — ปักที่ SHA `ac379f700b202502532fc0ad76e5b223a4a25147` (main หลัง merge PR #45) เพื่อให้ `server/order-link.js` ฉบับที่ซิงก์ `staff.position_id` มีผล
  **แก้ `server/*.js` ครั้งต่อไปต้อง deploy ฟังก์ชันใหม่ให้ชี้ SHA ใหม่เสมอ** (ของ `gas.enc` ไม่ต้อง — โหลดเองทุก 60 วิ)
- `it-monitor` version 6 — ตัดข้อตรวจ `MAIL_NOT_CONFIGURED` ออก

## Role Final Verifier: ปรับให้เป็นงานตรวจสอบล้วน (22 พ.ย. 2569 เย็น)
1. **ตัดสิทธิ์ `time` (Time Attendance)** ออกจากค่าเริ่มต้นของ verifier — เหลือ `approve_time`, `approve_stock`, `schedule_view` (แก้ทั้ง `63_RoleVerifier.gs` และ `js/role-verifier.js` ให้ตรงกัน)
2. **ตั้งรหัสปลดล็อกแอป (App Lock) ได้แล้ว** — ต้นเหตุ: `APP_LOCK_ROLES={staff,manager}` ใน `48_AppLock.gs` ไม่มี verifier → `devReg(check)` ตอบ `allowed:false` แอปเลยไม่ชวนตั้งรหัส · เพิ่ม `APP_LOCK_ROLES.verifier = 1` ใน `63_RoleVerifier.gs`
3. **หน้า Today ของ Role นี้เปลี่ยนใหม่** (`js/today-verifier.js`): ตัด "ของฉัน" (ปุ่มลงเวลา/กะ/ชั่วโมง) และ "วันนี้ของสาขา" ออก · แทนด้วยการ์ดสรุป (อนุมัติ / ไม่อนุมัติ / รออนุมัติ) + เลือกดูย้อนหลังรายวัน + รายการที่ตรวจไปแล้ว · Role อื่นใช้หน้าเดิมไม่เปลี่ยน
4. **การ์ดหัวหน้าใหม่** gradient เขียวพร้อมตราตรวจสอบ ทักทายตามเวลา บอก Role/สาขา และจำนวนที่ตรวจแล้ว
- `js/approve-history.js` เปิด `window.ApproveHistory = { items }` (อ่านอย่างเดียว) ให้ today-verifier ใช้ข้อมูลชุดเดียวกับหน้า Approvals
5. **รหัสปลดล็อกแอปใช้ได้ทุกระดับแล้ว** (`67_AppLockRoles.gs` + `js/app-lock-roles.js`): เดิม `APP_LOCK_ROLES` เป็นรายชื่อตายตัว {staff, manager} → HR / Admin / Role ใหม่ไม่เห็นเมนูและไม่มีใครรู้ · ตอนนี้คิดจาก `ROLES` ทั้งหมดทุกครั้งที่ใช้ และเจ้าของร้านปิดเป็นราย Role ได้ที่ Settings › Permissions (เก็บที่ `settings.appLockOff` · ว่าง = เปิดทุกระดับ) · บัญชีหลัก owner ยังใช้ทางของตัวเองใน `60_OwnerAppLock.gs`
6. **My Workspace / แท็บ Clock ซ่อนสำหรับ Role ที่ไม่ลงเวลา** — เดิมเงื่อนไขคือ `S.me.empId` อย่างเดียว ใครผูกพนักงานก็เห็นหมด · เพิ่ม `myWorkspace()` ใน `js/app.js` (3 จุด) อ่านจาก `settings.noClockRoles` (ค่าเริ่มต้น `verifier`) · เซิร์ฟเวอร์เพิ่มคีย์นี้ใน `PUBLIC_SETTINGS` (63_RoleVerifier.gs)
7. **app-lock.js มีรายชื่อ Role ซ้ำอีกชุดฝั่งหน้าเว็บ** (`ROLES = {staff, manager}`) — แก้เซิร์ฟเวอร์อย่างเดียวจึงไม่พอ แอปไม่เคยถามเซิร์ฟเวอร์ด้วยซ้ำ · ตัดรายชื่อฝั่งหน้าเว็บทิ้ง ให้ `devReg check` ของเซิร์ฟเวอร์เป็นคนตัดสินที่เดียว
8. **ปุ่มแป้นรหัสปลดล็อกเป็นวงรี** — CSS เดิมเอาความกว้างจากคอลัมน์ grid (68–72px) แต่เอาความสูงจาก `clamp(..,vh,..)` คนละทาง ทำให้สองค่าไม่เท่ากันเกือบทุกจอ · แก้เป็น `aspect-ratio:1` แล้วให้ทุก breakpoint ย่อที่ "ความกว้างคอลัมน์" แทนการตั้งความสูง · ทดสอบ 8 ขนาดจอ (รวมแนวนอนและจอเตี้ย) ปุ่มกลมครบ ไม่ล้นจอ กดได้ทุกจอ (>=44px)

## หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) — ต้นฉบับ / สำเนา
- เดิมพิมพ์ 2 ใบต่อรายการ แต่ใบแรกใช้ **เลขลำดับรายการ** มาเป็นเลขฉบับ (`'ฉบับที่ ' + (i+1)`) ทำให้รายการที่ 2 กลายเป็น "ฉบับที่ 2 — ผู้มีหน้าที่หักภาษี" ซึ่งผิด และไม่มีคำว่าต้นฉบับ/สำเนา
- แก้ที่ `modules/finance/js/fin-pages-docs.js`: ทุกรายการพิมพ์ **ต้นฉบับ (ฉบับที่ 1) — สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี** และ **สำเนา (ฉบับที่ 2) — เก็บไว้เป็นหลักฐาน** · ใส่กรอบให้คำว่าต้นฉบับ/สำเนาเด่นเวลาพิมพ์
- bump `fin-pages-docs.js?v=1.2.2` ใน `fin-core.js` และ `V=1.3.4` ใน `js/finance-embed.js`
## กระดิ่ง "งานที่รอคุณ" รวม 2 ระบบ + Today ของ Final Verifier เห็นงาน Finance
- `js/work-inbox.js` (ใหม่): รวมงานค้างจากหลังร้าน (`approvals()` ใช้ข้อมูลในเครื่อง ไม่เรียกเซิร์ฟเวอร์เพิ่ม) กับงานเบิก–เคลียร์ (`finance-api?action=expense-flow&tab=todo` ถามครั้งเดียวแล้วจำ 60 วิ · 401/403 = ปิดถามถาวรสำหรับบัญชีนั้น) · แสดงกระดิ่งใน `.topbar .tools` ทุกหน้าจอ · กดแล้วเห็นรายการพร้อมลิงก์ไปถูกระบบ
- เปิด `window.WorkInbox = { total, finTodo, finItems, refresh }` ให้ไฟล์อื่นใช้ตัวเลขชุดเดียวกัน
- `js/today-verifier.js`: ไทล์ "รออนุมัติตอนนี้" และการ์ดหัว นับรวมงาน Finance แล้ว + เพิ่มส่วน "เบิก–เคลียร์ค่าใช้จ่าย ที่รอคุณตรวจ" พร้อมลิงก์เข้าใบนั้นตรงๆ (แก้ปัญหา Role นี้ไม่มีหน้า Approvals ของตัวเอง)
- **บทเรียน**: `MutationObserver` ที่เรียกฟังก์ชันซึ่งเขียน DOM กลับเข้าไปในขอบเขตที่เฝ้าอยู่ = วนลูปไม่รู้จบ (เจอตอนเทสต์ เบราว์เซอร์ค้าง) · แก้ด้วยการเขียน DOM เฉพาะตอนค่าเปลี่ยนจริง + รวมรอบด้วย `requestAnimationFrame` · มีเทสต์กันไว้แล้ว

## อนุมัติแล้วหน้าจอเปลี่ยนทันที (perf)
- **วัดจากข้อมูลจริงก่อนแก้**: ฝั่งเซิร์ฟเวอร์ 1–3 มิลลิวินาที (`it_perf` via=s) แต่เวลาที่วัดจากเครื่องผู้ใช้ (via=w) 0.4–23 วินาที → คอขวดคือการเดินทางไป–กลับของเน็ต ไม่ใช่เซิร์ฟเวอร์ อย่าไปไล่ปรับฝั่งเซิร์ฟเวอร์
- `js/approve-fast.js` (ใหม่): ทับเฉพาะ action ที่ยืนรอผลกลับ — `apFix` (ขอแก้เวลา) และ `apAll` (อนุมัติทั้งหมด หมวด FIX) เปลี่ยนไปใช้ `DB.bg` · เวลาทำงานที่เซิร์ฟเวอร์คำนวณกลับมา (`extra.attendance`) ยังลงครบ แค่ลงเมื่อผลมาถึง · ล้มเหลวเมื่อไร `DB.bg` คืนค่าเดิมและเตือนให้เอง
- ทุก action อนุมัติ อัปเดตเลขบนกระดิ่งด้วย (เรียก `WorkInbox.refresh(false)` ใช้ค่าที่จำไว้ ไม่ยิงเซิร์ฟเวอร์ซ้ำ)
- **ฝั่ง Finance ยังไม่แก้**: `fin-pages-flow.js` ทำ `api.post` แล้วตามด้วย `F.reload()` = ไป–กลับ 2 รอบเรียงกัน เป็นดีไซน์ของโมดูลนั้น ถ้าจะทำให้ทันทีต้องแก้แกนกลางของโมดูล Finance — รอเจ้าของร้านตัดสินใจ

## ชื่อแอปตอนติดตั้งบนหน้าจอโฮม (PWA)
| หน้า | manifest | ชื่อเต็ม (กล่องติดตั้ง) | ชื่อบนหน้าจอโฮม |
|---|---|---|---|
| `owner.html` | `owner.webmanifest` | Café Amazon — App Owner | **App Owner** |
| `index.html` | `manifest.webmanifest` | Time - Workforce | **Workforce** |
| `clock.html` | `clock.webmanifest` | Café Amazon — App Staff | **App Staff** |
- ตั้งไว้ 3 ที่ให้ตรงกันเสมอ: `name` / `short_name` ใน manifest, `<meta name="apple-mobile-web-app-title">` และ `<title>` (iOS ใช้ title เป็นชื่อสำรอง)
- `short_name` ต้องไม่เกิน 12 ตัวอักษร ไม่งั้น Android ตัดท้ายเป็น …
- **Android / Chrome / คอมพิวเตอร์: บังคับได้** ผู้ใช้แก้ชื่อตอนติดตั้งไม่ได้ · **iOS/iPadOS: บังคับไม่ได้** Safari เปิดช่องให้พิมพ์แก้ก่อนกดเพิ่มเสมอ เราทำได้แค่ตั้งชื่อตั้งต้น (ข้อจำกัดของ Apple ไม่มีทางปิด)
- เครื่องที่ติดตั้งไว้ก่อนแล้ว: Android เปลี่ยนชื่อให้เองเมื่อเปิดแอปครั้งถัดๆ ไป · iOS ต้องลบไอคอนเดิมแล้วเพิ่มใหม่
