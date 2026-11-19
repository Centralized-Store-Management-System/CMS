# IT Report: HR Employee Documents, Birthdays and Advanced IT Monitor

วันที่: 19 พ.ย. 2569  
Project: CMS / Supabase `ytxbnqosenolojifeikf`

## 1) People > HR > Employees — เอกสารรายบุคคล

เพิ่มแผง `เอกสารประจำตัวพนักงาน` ในหน้ารายละเอียดพนักงานแต่ละคน รองรับหมวด:
- Resume / ประวัติส่วนตัว
- บัตรประชาชน
- วุฒิการศึกษา
- สัญญาจ้าง
- เอกสารธนาคาร
- ใบรับรองแพทย์
- ประกันสังคม
- เอกสาร PDPA
- เอกสารอื่น ๆ

รองรับ PDF, JPG, PNG, WEBP ขนาดไม่เกิน 20 MB ต่อไฟล์ สามารถอัปโหลดหลายไฟล์ในครั้งเดียว กด View เพื่อดู PDF/รูปภาพ และลบไฟล์ได้จากหน้ารายละเอียดพนักงาน

### Security / Access Control
- สร้าง Edge Function แยกชื่อ `hr-documents` ไม่แก้หรือ redeploy `backoffice`
- ตรวจ CMS session ด้วยการเรียก `bootstrap` ของ Back Office จากฝั่ง Edge Function
- อนุญาตเฉพาะ Owner หรือผู้ที่มี permission `hr` และตรวจ `scope` สาขาก่อนอ่าน/อัปโหลด/ดู/ลบ
- ใช้ Private Storage bucket `hr-employee-documents` เท่านั้น (ไม่ใช้ `backoffice-public`)
- สร้าง Signed URL สำหรับเปิดดูอายุ 5 นาที ไม่เปิด Public URL
- ตรวจ MIME type และ file signature ก่อนบันทึก
- บันทึก metadata แยกจากข้อมูลพนักงาน และเก็บ audit event upload/view/delete
- ปิดสิทธิ์ SELECT/INSERT/UPDATE/DELETE ของ `anon` และ `authenticated` ต่อ metadata tables; เปิด RLS และให้สิทธิ์เฉพาะ `service_role`

### Database
สร้างตารางใหม่:
- `public.hr_employee_documents`
- `public.hr_employee_document_audit`

ตารางทั้งคู่เปิด RLS, ไม่มี policy ที่อนุญาต user/client โดยตรง และ revoke table privileges จาก `anon`, `authenticated`. ตรวจแล้ว: `anon_select=false`, `authenticated_select=false`, `service_select=true`.

## 2) HR — วันเกิดวันนี้ / พรุ่งนี้
- แสดงใต้รายชื่อ Employees
- คัดเฉพาะพนักงานที่ยังทำงานอยู่ และอยู่ใน employee/branch scope ที่ผู้ใช้เห็น
- แยกกลุ่มวันนี้และพรุ่งนี้ ไม่แสดงพนักงานลาออก

## 3) Owner > ระบบ IT — AI Monitoring · Advanced
เพิ่ม Diagnostic Engine v1 โดยดึงข้อมูลจาก API เดิมของระบบ:
- `it/status` — สถานะการตรวจสอบระบบที่มีอยู่
- `it/perf` — ตัวอย่างความเร็วและข้อผิดพลาด
- `it/events` — เหตุการณ์ระบบ
- `it/dash(days=7)` — Incident และปัญหาย้อนหลัง 7 วัน

คำนวณ Risk Score, จัดลำดับ Bad/Warn, ตรวจ p95/เวลาสูงสุด/อัตราผิดพลาด และเหตุการณ์ที่เกิดซ้ำ รีเฟรชอัตโนมัติทุก 5 นาทีขณะเปิดหน้า IT และมีปุ่มวิเคราะห์ใหม่

**ข้อจำกัดที่ต้องระบุ:** Engine รุ่นนี้เป็น rule-based diagnostic / anomaly scoring ไม่ใช่ Generative AI หรือ ChatGPT และไม่ส่งข้อมูลพนักงานออกนอก Supabase หากต้องการให้ AI สร้างคำตอบ/แนะนำเชิงภาษาแบบ LLM ต้องกำหนดผู้ให้บริการและจัดเก็บ API key เป็น Edge Function Secret ก่อน

## 4) ขอบเขตที่ไม่แตะต้อง
- ไม่แก้ `server/gas.enc` หรือ source runtime ของ Back Office
- ไม่เปลี่ยน Edge Function `backoffice` v10
- ไม่แก้ระบบ Branch / Employee master data / User / Permission
- ไม่แก้ Staff / Manager App Lock, PC Login, Authenticator, Passkey, LINE / LIFF / Time Clock
- ไม่แก้ Line-Order, Orders, Product, Catalog, Public Staff schema

## 5) Files / Deployment
- `js/mod-hr.js` — birthday panel
- `js/hr-documents.js` — upload/list/view/delete UI
- `supabase/functions/hr-documents/index.ts` — secure document endpoint
- `js/it-ai.js` — advanced diagnostic engine
- `js/owner.js` — integrate AI monitor and 5-minute collection
- `index.html`, `owner.html` — script registration / cache version

Edge Function `hr-documents`: ACTIVE, version 5, `verify_jwt=false` because it validates the CMS custom session header inside the function. The bucket is created/verified as Private lazily on the first authorized file operation; it had not yet been exercised with a real HR token during this review.

Latest backend hardening commits: `60a57ff` (accept scope array or string), `0b28b5d` (transactional metadata/audit writes), `bc8f4b5` (remove duplicate authorization call on preview), `81a4cac` (ensure Owner branch-wide access).

Database migration: `20261119143656_hr_employee_documents_secure_storage`.

## 6) Test / Remaining
Verified:
- Database migration applied successfully
- RLS enabled on both new tables
- Anon and authenticated have no SELECT privileges; service_role has SELECT
- JavaScript syntax passed for `mod-hr.js`, `hr-documents.js`, `it-ai.js`, `owner.js`
- Edge Function bundled and deployed successfully (version 5)
- Front-end scripts registered in the correct HTML entrypoints

Remaining end-to-end checks:
1. Sign in using an actual HR account and verify its own branch documents list.
2. Try opening another branch's employee document; expect HTTP 403/404.
3. Upload a sample PDF and image, then preview, download/open and delete.
4. Confirm bucket `hr-employee-documents` is created as Private on first authorized document operation.
5. Open Owner > System IT and confirm the four data sources populate and refresh after 5 minutes.
6. Confirm Staff/Manager PWA, Time Clock, LINE and Line-Order continue to work.


## 7) Always-on Background IT Monitor (เพิ่มเติม 19 พ.ย. 2569)
ผู้ใช้ต้องการให้ระบบตรวจและวิเคราะห์ต่อเนื่องแม้ไม่ได้เปิด Owner > ระบบ IT หรือปิดอุปกรณ์ จึงเพิ่ม Monitor ฝั่ง Server แยกจากหน้าเว็บ

- Edge Function ใหม่: it-monitor (ACTIVE v1; verify_jwt=false แต่ endpoint ภายในตรวจ CRON_KEY และ endpoint อ่าน/สั่งทำงานตรวจ CMS Owner session)
- pg_cron job ใหม่: it-monitor-every-5-minutes, job_id=2, schedule */5 * * * *, active=true
- ใช้ backoffice CRON_KEY ที่มีอยู่ ไม่เก็บ secret ไว้ใน source code
- ทุก 5 นาที backend อ่านข้อมูลสุขภาพจาก DB, SUPA_IT, ORDER_IT, ORDER_SYNC_LAST, ORDER_SSO_LOG, Cron heartbeat, outbox errors, จำนวนออเดอร์ย้อนหลัง 24 ชั่วโมง, ออเดอร์ค้างเกิน 90 นาที และความพร้อม Private HR bucket
- บันทึก Risk Score, Findings, Metrics ลง public.it_monitor_runs; retention 90 วัน; มี advisory lock กัน monitor ซ้อนกัน
- หน้า Owner > ระบบ IT อ่านผลล่าสุดจาก monitor และมีปุ่ม ตรวจระบบเดี๋ยวนี้ เพื่อเรียกตรวจทันที; หน้าจอยังโหลด Performance/Event/Incident drilldown เพิ่มเติมขณะเปิดหน้า
- ทดสอบเรียก backend cron endpoint ด้วย pg_net แล้วได้ HTTP 200 และ snapshot แรก Risk Score 100 / healthy; ขณะตรวจพบ Cron heartbeat ปกติ, outbox errors 0, order sync errors 0, stale orders 0. พบเพียง INFO ว่า HR bucket ยังไม่เริ่มสร้าง (จะสร้างเมื่ออัปโหลดครั้งแรก) และยังไม่ตั้งค่าอีเมล
- ตรวจแล้ว cron job it-monitor-every-5-minutes active=true

ขอบเขต: Background Monitor ตรวจเฉพาะข้อมูลที่ backend และฐานข้อมูลมี telemetry/heartbeat ให้ใช้ ไม่สามารถตรวจการแสดงผลใน browser/อุปกรณ์ที่ปิดอยู่โดยตรง; รายละเอียด Performance/Event/Incident ของฝั่ง Owner runtime จะถูกดึงเพิ่มเมื่อหน้า IT เปิดอยู่

Commits เพิ่มเติม: 12c3069 (monitor service), dc931a1 + be48f15 (persistent monitor UI), 402fe3a (manual run), 70e33f8 (cache bust).

Supabase Security Advisor reports INFO `rls_enabled_no_policy` for these two new tables. This is intentional: direct client access is denied by table privileges and RLS; the server-only Edge Function accesses them with service_role. Other existing advisor findings are not part of this change.


## HR Documents directory tab (19 พ.ย. 2569)
- เพิ่มเมนูย่อย `HR > Documents` หลัง Employees และ Recruitment
- แสดงรายชื่อพนักงานเฉพาะตาม scope/branch ที่ผู้ใช้มีสิทธิ์; เลือกชื่อพนักงานแล้วจึงแสดงเอกสารของบุคคลนั้น
- เอกสารเรียง `created_at DESC` เพื่อให้รายการที่อัปโหลดล่าสุดอยู่ด้านบน พร้อมชื่อไฟล์ ประเภท ขนาด และวันเวลาอัปโหลด
- ปุ่ม View ขอ signed URL จาก `hr-documents` ขณะเปิดดูเท่านั้น (อายุ 5 นาที); ปุ่มจัดการ/เพิ่มเอกสารเปิด Employee form เดิมเพื่อใช้งาน upload workflow เดิม
- ไม่เปลี่ยน schema, Edge Function หรือสิทธิ์การเข้าถึงเดิมในส่วนนี้
- Commits: `db0bc09`, `ff2ac4b`, `8759026`
- สถานะตรวจสอบ: ตรวจพบ source changes บน `main`; ยังไม่ถือว่า UAT ผ่านจนกว่าจะทดสอบจริงด้วยบัญชี Owner/HR และยืนยัน branch isolation หลัง GitHub Pages deploy


## HR Documents API CORS correction (19 พ.ย. 2569)
- ตรวจ logs พบ browser preflight `OPTIONS` สำหรับรายการเอกสารตอบ HTTP 403 ที่ Edge Function v5 จึงถูก browser ปิดกั้นและแสดง `Failed to fetch`
- สาเหตุคือ GitHub Pages origin ที่ใช้งานจริง `https://centralized-store-management-system.github.io` ไม่อยู่ใน CORS allowlist เดิม
- เพิ่ม exact origin นี้ใน allowlist โดยยังคง origin เดิมไว้และไม่เปิด wildcard
- Deploy Edge Function `hr-documents` เป็น ACTIVE v6; GitHub source commit `390f36a`
- ตรวจ Function metadata หลัง deploy ยืนยัน v6 ACTIVE และมี allowlist ทั้งสอง domains; รอ reload และตรวจผลจาก browser จริงเพื่อยืนยันหลังแก้ไข


## Owner Console — Dedicated AI Monitoring · Advanced menu (19 พ.ย. 2569)
- ผู้ใช้ไม่เห็นเมนู Advanced ใน sidebar เพราะเวอร์ชันก่อนฝัง panel ไว้ท้ายหน้า `ตรวจ & ซ่อมอัตโนมัติ` แต่ยังไม่ได้สร้าง route/menu แยก
- เพิ่มเมนูชัดเจน `AI Monitoring · Advanced` ภายใต้ `2. Super Advance IT` และ route `#ai`; แยกหน้าจาก `ตรวจ & ซ่อมอัตโนมัติ`
- หน้าใหม่รวบรวมข้อมูลจาก IT Status, Performance, Event History และ Incident Dashboard 7 วัน พร้อม Background IT Monitor; refresh ขณะเปิดหน้า AI ทุก 5 นาที
- Background cron เดิมยังทำงานทุก 5 นาทีอิสระจาก browser/device
- ไม่แก้ระบบ heal/repair และไม่เปลี่ยน `backoffice` Edge Function หรือแหล่งข้อมูลเดิม
- Commits: `258cb16`, `77eebce`


## HR Document upload 500 correction (19 พ.ย. 2569)
- POST upload ตอบ 500; CORS preflight และ GET list ผ่านแล้ว
- Root cause จาก runtime log: `ensurePrivateBucket()` ได้ HTTP 400 `NoSuchBucket` จาก Storage API แต่โค้ดเดิมยอมรับเฉพาะ HTTP 404 จึงไม่เข้าสู่ขั้นตอน create bucket
- แก้เงื่อนไขให้รับเฉพาะ 400 ที่ระบุ `NoSuchBucket`/`Bucket not found` เป็น missing bucket แล้ว deploy `hr-documents` ACTIVE v7
- สร้าง `hr-employee-documents` bucket ผ่าน migration ให้เป็น Private (`public=false`), จำกัด 20 MB และ MIME PDF/JPG/PNG/WEBP; ตรวจ record หลัง migration แล้ว
- Source commit `87c3ef5`; migration `20261119150233_create_private_hr_employee_documents_bucket`
- สถานะ: root cause fixed + private bucket provisioned; ต้องยืนยัน upload จริงหลัง deployment ก่อนระบุว่า end-to-end ผ่าน


## Follow-up: Background IT Monitor CORS + performance warning calibration (19 พ.ย. 2569)
- Root cause of `Failed to fetch` on Background IT Monitor: preflight OPTIONS to `it-monitor` was rejected with 403 because actual GitHub Pages hostname was absent from the allowlist. Added the exact second hostname while retaining the original; deployed `it-monitor` ACTIVE v2. No wildcard CORS.
- Tuned performance diagnosis: a small number of sampled request failures now creates a warning rather than an immediate red/bad status; critical classification reserved for sustained failure ratio (`fail >= 5` and `fail >= sample count`) or severe latency (P95 >= 15s / max >= 30s). P95 >= 8s or max >= 15s remains warning.
- Browser-side JS syntax checked; scheduled server monitor still returns HTTP 200 after deploy. Latest front-end preflight from production domain should be confirmed after user refreshes Owner Console.

## HR Documents directory controls and upload verification (19 พ.ย. 2569)
- Filename itself is now clickable for preview. Each row shows `View | ลบ` from the Documents directory (not only inside the employee upload dialog). Delete uses authenticated API and updates the directory after success.
- Cache bust updated: `hr-documents.js?v=1.1.1` and `it-ai.js?v=1.0.2`.
- Production verification: function logs include HR upload POST 200, list GET 200, and preview GET 200; DB/storage consistency query found 2 active metadata records and matching objects for both. Bucket is confirmed private.
- Commits: `2b7cd1b`, `515799f`, `d66030a`, `c04ebbb`, `e481111`.

- ปรับ KPI counts ให้สรุปจำนวน Finding ระดับ critical/warning ตามรายการวิเคราะห์จริง รวม performance warnings ด้วย; commit `288fc37`, Owner cache bust `it-ai.js?v=1.0.3`.
