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
