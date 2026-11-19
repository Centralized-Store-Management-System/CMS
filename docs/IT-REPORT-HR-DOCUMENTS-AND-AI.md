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

Supabase Security Advisor reports INFO `rls_enabled_no_policy` for these two new tables. This is intentional: direct client access is denied by table privileges and RLS; the server-only Edge Function accesses them with service_role. Other existing advisor findings are not part of this change.
