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
