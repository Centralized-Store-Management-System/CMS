# Architecture Blueprint — Role-separated Applications, Shared Data Platform

วันที่จัดทำ: 20 พ.ย. 2569  
สถานะ: Blueprint / ยังไม่เปลี่ยนระบบ Production

## 1. เป้าหมายและหลักการ

แยกการพัฒนาและการ deploy ของ 5 แอปออกจากกันอย่างชัดเจน โดยใช้ฐานข้อมูลกลางและสัญญาการเชื่อมต่อชุดเดียวกัน

1. Owner
2. Manager (Mgr)
3. HR
4. Staff
5. Super Admin

**หลักสำคัญ:** แยก Source Code / UI / Release / Permission / Test ของแต่ละแอป แต่ไม่แยกฐานข้อมูลธุรกิจ และไม่ทำสำเนาข้อมูลหลักไปเก็บซ้ำในแต่ละแอป

- ทุกแอปอ่าน/เขียนข้อมูลผ่าน API contract กลาง ไม่เรียกแก้ตารางข้ามกันโดยตรง
- แต่ละแอปมีสิทธิ์และขอบเขตข้อมูลตาม Role + Branch Scope
- การแก้ไขแอปหนึ่งต้องไม่ทำให้แอปอื่นต้องแก้ตาม เว้นแต่มีการเปลี่ยน Shared Contract ซึ่งต้องมี version และทดสอบความเข้ากันได้
- คงหน้าตา เมนู และกติกาการทำงานเดิมเป็นหลักในระยะแรก (Refactor without business-rule changes)
- ไม่ย้ายข้อมูลจริง ไม่เปลี่ยน schema และไม่ deploy ระบบใหม่ในงาน Blueprint นี้

## 2. ภาพรวมสถาปัตยกรรมเป้าหมาย

```
                 ┌───────────────────────────────┐
                 │       SHARED DATA PLATFORM    │
                 │ Supabase Auth + PostgreSQL    │
                 │ Storage + Realtime + Audit    │
                 └───────────────┬───────────────┘
                                 │
                       Shared API Gateway
                    Backoffice / Domain Services
                                 │
       ┌──────────┬──────────┬───┴────┬───────────┬────────────┐
       │          │          │        │           │            │
   Owner App   Mgr App    HR App  Staff App  Super Admin App
   owner/      manager/   hr/     staff/     super-admin/
   own release own release own release own release own release
       │          │          │        │           │
       └──────────┴──────────┴────────┴───────────┘
                    Shared Contracts / SDK
```

**แยกแอป ไม่ใช่แยกข้อมูล:** ทุกแอปใช้ Project / Database กลางชุดเดิม แต่ผ่าน API ที่กำหนดขอบเขตการเข้าถึง ไม่ให้ Frontend ของแอปหนึ่งเข้าถึงข้อมูลที่ไม่เกี่ยวข้อง

## 3. ขอบเขตหน้าที่แต่ละแอป

### 3.1 Owner App — เจ้าของร้าน / ผู้บริหาร
- Dashboard ภาพรวมร้านและผลการดำเนินงาน
- Approvals: อนุมัติคำขอและดูประวัติ
- Schedule: ดู/จัดการตารางงานตามสิทธิ์
- Time Attendance: ตรวจสอบเวลาและคำขอที่เกี่ยวข้อง
- HR Overview: ดูข้อมูลบุคลากรในขอบเขตที่ได้รับอนุญาต
- Stock / Product / Accounting / Payroll: ดูภาพรวมและอนุมัติตามสิทธิ์ที่กำหนด
- Branch Management: จัดการข้อมูลสาขา
- User & Device Management: จัดการบัญชีและอุปกรณ์
- IT Control Center / Diagnostics: สถานะระบบ การตั้งค่ากลาง และการตรวจสอบ
- Owner App Lock / Login / Session

ข้อกำหนด: หน้าแรก Owner คง 2 ทางเข้าตามกติกาปัจจุบัน คือ “จัดการร้าน” และ “ระบบ IT” ไม่เพิ่มปุ่มหน้าแรกโดยพลการ

### 3.2 Manager App — ผู้จัดการสาขา
- Dashboard เฉพาะสาขาที่รับผิดชอบ
- Schedule: สร้าง/แก้ไข/เผยแพร่ตารางตามสิทธิ์
- Attendance: ตรวจสอบเวลาเข้า-ออกและรายการผิดปกติ
- Approvals: อนุมัติคำขอของทีมตามสายบังคับบัญชา
- Staff: ดูข้อมูลพนักงานในสาขาและจัดการงานที่ได้รับอนุญาต
- Stock / Product / Sales Operations: งานปฏิบัติการสาขาตามโมดูลที่เปิดใช้
- Reports: รายงานสาขาและทีม
- Notifications: แจ้งเตือนงานค้างและสถานะ

### 3.3 HR App — งานบุคคล
- Employee Master: ประวัติพนักงานและสถานะการทำงาน
- Recruitment: ผู้สมัครและกระบวนการสรรหา
- Employee Documents: เอกสารส่วนบุคคล พร้อมสิทธิ์การดู/เพิ่ม/ลบและ Audit
- Leave / Attendance Review: ตรวจสอบข้อมูลที่เกี่ยวข้องกับงานบุคคล
- Employee Changes: ประวัติการเปลี่ยนตำแหน่ง/สาขา/สถานะ
- HR Reports: รายงานบุคลากรและวันเกิด
- HR Notifications: เอกสารหมดอายุ/งานค้าง

ข้อมูลอ่อนไหว เช่น บัตรประชาชน บัญชีธนาคาร และเอกสารสุขภาพ ต้องจำกัดสิทธิ์เฉพาะผู้ได้รับอนุญาต ไม่เปิดให้ Manager หรือ Staff โดยอัตโนมัติ

### 3.4 Staff App — พนักงาน
- Login / App Lock / Device Binding
- Today: ข้อมูลกะและรายการที่ต้องทำ
- Schedule: ตารางงานของตนเอง
- Time Attendance: ลงเวลาและดูประวัติของตนเอง
- Leave / Requests: ส่งคำขอและติดตามสถานะ
- OT Request: พนักงานเป็นผู้ยื่นคำขอเองตามกติกาปัจจุบัน (ห้ามเปิด OT อัตโนมัติ)
- Profile: ข้อมูลส่วนตัวที่แก้ไขได้ตามนโยบาย
- Notifications: แจ้งเตือนตารางและผลอนุมัติ
- LINE/LIFF entry point คงแยกตามหน้าที่และต้องไม่โหลดทรัพยากรหนักโดยไม่จำเป็น

### 3.5 Super Admin App — ผู้ดูแลระบบสูงสุด
- Global User / Role / Permission Administration
- Branch / Organization Configuration
- Role-to-Module & Feature Flags
- API / Integration Health และระบบเชื่อมต่อ
- Audit Trail / Security Events
- System Configuration / Reference Data
- Release / Version / Compatibility Monitor
- Data Quality / Reconciliation Monitor
- Emergency Access แบบมีเหตุผล ระยะเวลา และ Audit

Super Admin เป็นบทบาททางเทคนิคที่แยกจาก Owner ทางธุรกิจ ไม่ควรถือว่า Owner ทุกคนเป็น Super Admin โดยอัตโนมัติ การเข้าถึงต้องใช้สิทธิ์เฉพาะและบันทึก Audit ทุกครั้ง

## 4. Shared Platform — ส่วนที่ทุกแอปใช้ร่วมกัน

### A. Identity & Access
- Supabase Auth เป็นตัวตนกลาง
- ผูก Auth User กับรหัสพนักงาน/ผู้ใช้ระบบ (stable user identity)
- Role, Permission, Branch Scope และสถานะบัญชีเป็นข้อมูลกลาง
- Session / Device Binding / App Lock แยกตามแอปได้ แต่ตรวจสอบตัวตนจาก Identity กลาง
- ห้ามใช้ข้อมูลจาก user-editable metadata เป็นแหล่งตัดสินสิทธิ์

### B. Organization & Master Data
- Branch Master
- Employee / Staff Master
- User & Role Master
- Product / Category / Option Master
- Reference Data / Status Codes
- ใช้ UUID หรือรหัสกลางที่ไม่เปลี่ยนตามชื่อแสดงผล
- เปลี่ยนชื่อสาขาหรือชื่อพนักงานต้องไม่ทำให้ Foreign Key หรือประวัติเดิมเสีย

### C. Domain Services / API
กำหนด API ตามโดเมน ไม่ผูกกับชื่อหน้า UI เช่น:
- identity
- organization
- employee
- schedule
- attendance
- leave
- approval
- inventory
- product
- sales / order integration
- payroll
- accounting
- notification
- documents
- reporting
- system administration

ทุก API ต้องมี schema ของ Request/Response, permission ที่ต้องใช้, branch scope, error codes และ version

### D. Audit / Event / Notification
- บันทึกผู้กระทำ เวลา แอปต้นทาง รายการที่เปลี่ยน และค่า before/after ตามความเหมาะสม
- ทุกการเปลี่ยนสถานะสำคัญต้องมี event กลาง
- Notification เป็นผลจาก event ไม่ใช่ให้แต่ละแอปสร้างสถานะซ้ำเอง
- งานที่ต้องส่งต่อระบบอื่นใช้ Outbox + Retry + Idempotency Key
- ต้องตรวจสอบย้อนหลังได้ว่าใครส่งข้อมูลจากแอปใด และปลายทางรับแล้วหรือยัง

## 5. ข้อมูลที่ต้องเชื่อมโยงกัน

| ข้อมูลต้นทาง | ผู้ดูแลหลัก (เสนอ) | แอปที่ใช้ข้อมูล | การเชื่อมโยง |
|---|---|---|---|
| User / Role / Permission | Super Admin | ทุกแอป | ใช้ตัวตนและสิทธิ์ชุดเดียว |
| Branch | Owner / Super Admin ตามสิทธิ์ | ทุกแอป | Branch ID กลาง |
| Employee | HR | Owner, Mgr, HR, Staff | Employee ID กลาง |
| Schedule | Mgr / Owner ตามสิทธิ์ | Staff, Mgr, HR, Owner | ผูก Employee + Branch + Date |
| Attendance | Staff เป็นผู้บันทึก; Mgr/HR ตรวจตามสิทธิ์ | Staff, Mgr, HR, Owner | ผูก Employee + Schedule |
| Leave / OT Request | Staff เป็นผู้ยื่น; ผู้มีอำนาจอนุมัติ | Staff, Mgr, HR, Owner | Request ID + Approval History |
| Approval | ผู้อนุมัติตามสายสิทธิ์ | Owner, Mgr, HR, Staff | เก็บผู้อนุมัติและสถานะกลาง |
| Product / Stock | ผู้รับผิดชอบงานสินค้า | Mgr, Owner, Super Admin | Product ID + Branch ID |
| Payroll | HR/ผู้รับผิดชอบ Payroll | HR, Owner, Staff (เฉพาะข้อมูลตนเอง) | อ้างอิง Attendance/Leave/OT ที่ผ่านการตรวจ |
| Documents | HR | HR และผู้ได้รับอนุญาต | Employee ID + Document Audit |
| Reports | คำนวณจาก Domain Data | ตาม Role/Scope | ห้ามเก็บตัวเลขซ้ำเป็นคนละแหล่งจริง |
| Notifications | ระบบกลาง | ทุกแอป | Event ID + Recipient ID |

ตารางนี้เป็นข้อเสนอการกำหนดเจ้าของข้อมูล (Data Ownership) ต้องตรวจเทียบกับกระบวนการจริงและสิทธิ์ปัจจุบันก่อนบังคับใช้

## 6. โครงสร้าง Source Code ที่เสนอ

แนะนำ Monorepo แบบแยก Application Package เพื่อให้แชร์สัญญาได้ แต่ไม่แชร์ไฟล์หน้าจอหรือ business logic ข้ามแอปโดยตรง

```
apps/
  owner/
    index.html
    src/
    styles/
    tests/
  manager/
    index.html
    src/
    styles/
    tests/
  hr/
    index.html
    src/
    styles/
    tests/
  staff/
    index.html
    src/
    styles/
    tests/
  super-admin/
    index.html
    src/
    styles/
    tests/

packages/
  api-client/       # ติดต่อ API กลาง, session, retry, idempotency
  contracts/        # Request/Response schema + error codes
  identity/         # Auth adapter; ไม่เก็บ role rules แบบกระจาย
  permissions/      # Permission evaluation / branch scope
  domain-types/     # Shared IDs, enums, data types
  audit-client/     # ส่ง audit context
  event-client/     # Subscribe/consume notifications/events
  ui-foundation/    # Design tokens และ component พื้นฐานเท่านั้น

services/
  backoffice-api/   # API gateway / existing backoffice adapter
  domains/          # Domain services แยกตามขอบเขตธุรกิจ
  integrations/     # Line-Order และระบบภายนอก

supabase/
  migrations/
  functions/
    backoffice/
    hr-documents/
    it-monitor/

docs/
  architecture/
  data-dictionary/
  api-contracts/
  runbooks/
```

ข้อสำคัญ:
- แต่ละ app ต้อง build / test / release แยกได้
- package กลางต้องมี version และ backward compatibility
- ห้าม import ไฟล์ภายใน `apps/owner` จาก `apps/hr` หรือแอปอื่น
- ห้ามให้ app เขียนลงตารางของโดเมนอื่นโดยตรง
- การแชร์ให้แชร์ผ่าน contracts, API client และ design tokens
- CSS ของแต่ละแอปแยก scope; UI foundation มีเฉพาะ component กลางที่ไม่ผูก business rules

## 7. Mapping จากระบบปัจจุบันไปยังโครงสร้างใหม่

จากไฟล์กำกับระบบปัจจุบัน:
- Back Office PC/Mobile: `index.html`, `js/app.js`, `js/mod-*.js`
- Owner & IT: `owner.html`, `js/owner*.js`
- Staff App / LIFF / Clock: `clock.html`, `js/clock*.js`, `js/liff-view.js`
- API กลางปัจจุบัน: `js/config.js` → Supabase Edge Function `backoffice`
- Server runtime: `server/runtime.js`, `server/store-pg.js`, `server/order-link.js`
- Business logic เดิมอยู่ใน `server/gas.enc` ซึ่งเข้ารหัสและต้นฉบับอยู่นอก repo; ห้ามแก้ไฟล์นี้ด้วยมือ

การจัดกลุ่มไฟล์เดิมเพื่อวางแผน (ยังไม่ใช่การยืนยันว่าแยกครบแล้ว):
- Owner → Owner Console, IT Control, Branch/User/Device Admin
- Manager → โมดูลการจัดการร้านและการอนุมัติใน Back Office ตาม permission
- HR → HR, Recruitment, Employee Documents, HR reports
- Staff → Clock/Today/Schedule/Attendance/Leave/OT request
- Super Admin → ฟังก์ชันระดับระบบที่ปัจจุบันกระจายอยู่ใน Owner > IT และการตั้งค่าระบบ

## 8. ภาพข้อมูลปัจจุบันที่ตรวจพบ (20 พ.ย. 2569)

Supabase Project ที่เชื่อมกับ CMS: `ytxbnqosenolojifeikf`

ตารางใน `backoffice` schema ที่ตรวจพบ:
- books, sheets, rows, kv, files, folders, triggers, code, outbox_errors

ตารางใน `public` schema ที่ตรวจพบ:
- branches, staff, products, categories, branch_products, product_options, product_option_groups
- product_option_product_options, product_option_group_products, product_option_combinations
- orders, order_items, order_status_history, customers, customer_locations, customer_location_shares
- line_channels, line_liff_apps, line_chat_messages, staff_push_subscriptions, import_history
- hr_employee_documents, hr_employee_document_audit
- it_control_settings, it_control_audit, it_monitor_runs

**ข้อจำกัดที่ต้องระบุให้ชัด:** การมีตารางใน public ไม่ได้แปลว่าเป็นแหล่งข้อมูลจริงของทุกโมดูลทั้งหมด ข้อมูลธุรกิจเดิมจำนวนหนึ่งยังทำงานผ่าน runtime/storage ใน `backoffice` schema ดังนั้นก่อนย้ายโมดูล ต้องทำ Data Dictionary และ map API/action → logical entity → physical table/sheet → owner → consumer ให้ครบ ห้ามเดา schema หรือสร้างตารางซ้ำโดยไม่ตรวจสอบ

## 9. กติกาป้องกันการกระทบกัน

1. **App boundary:** แอปหนึ่งแก้ได้เฉพาะ `apps/<app>` และ package ที่รับผิดชอบ
2. **Contract boundary:** เปลี่ยน API/Schema กลางต้องเพิ่ม version หรือทำ backward-compatible change
3. **Database boundary:** มี Data Owner ต่อโดเมน; แอปอื่นเรียกผ่าน service/API
4. **Permission boundary:** ตรวจสิทธิ์ทั้ง API และฐานข้อมูล; ซ่อนเมนูอย่างเดียวไม่ถือว่าปลอดภัย
5. **Branch boundary:** ทุก query ที่เป็นข้อมูลสาขาต้องตรวจ Branch Scope ที่ฝั่ง server
6. **Audit boundary:** การแก้ข้อมูลสำคัญต้องบันทึก actor, source_app, request_id, timestamp และ before/after
7. **Release boundary:** deploy แยกแอปได้ แต่ shared API ต้องรองรับ client เก่าในช่วง rollout
8. **No silent schema drift:** ทุก schema change ต้องเป็น migration, review, test และมี rollback plan
9. **No cross-app CSS/JS patch:** ห้ามแก้ shared selector หรือ global function เพื่อแก้เฉพาะแอปใดแอปหนึ่ง
10. **Production safety:** ห้ามย้ายข้อมูล/เปลี่ยน business rule จนกว่าจะผ่าน regression test ทุกแอป

## 10. ลำดับดำเนินงาน

### Phase 0 — Inventory & Baseline (ก่อนแยกโค้ด)
- ทำรายการทุกเมนู/หน้าจอ/ฟังก์ชันที่ใช้งานจริงใน Owner, Mgr, HR, Staff, Super Admin
- ไล่ทุก API action และ server function ที่แต่ละหน้าเรียก
- ทำ Data Dictionary จากข้อมูลจริง รวม schema, sheet/table, key, relationship, permission, branch scope
- ทำ Dependency Map: ใครเป็นผู้สร้าง/แก้/อ่านข้อมูลแต่ละชนิด
- จัดทำ baseline screenshot และ regression checklist

### Phase 1 — Shared Contracts
- กำหนด ID, DTO, API response, error code และ permission matrix
- ทำ API client กลางแบบ versioned
- เพิ่ม audit context / request ID / idempotency
- ยืนยันว่า API เดิมยังทำงานได้

### Phase 2 — แยกแอปโดยไม่เปลี่ยนกติกา
- เริ่มแยก Owner shell และ assets ออกจาก Back Office
- ต่อด้วย Staff, HR, Manager, Super Admin ตามลำดับความเสี่ยงและความพร้อม
- คง API และฐานข้อมูลเดิม
- ทดสอบแต่ละแอปอิสระ พร้อม integration test กับข้อมูลกลาง

### Phase 3 — Domain Service Isolation
- แยก API ตามโดเมนจาก Back Office v10 ทีละกลุ่ม
- ย้าย logic เฉพาะเมื่อมี source ต้นฉบับและ test coverage
- ใช้ compatibility adapter ช่วงเปลี่ยนผ่าน
- ห้ามแก้ `server/gas.enc` โดยไม่มี source ต้นฉบับและแผน deploy ที่ตรวจสอบได้

### Phase 4 — Controlled Release
- Dev / Staging / Production แยก environment
- Deploy ทีละแอปและเปิดใช้แบบกลุ่มเล็ก
- ตรวจ Error Rate, API latency, data consistency, permission denial, audit
- มี rollback ไปเวอร์ชันก่อนหน้าได้โดยไม่ต้อง rollback ข้อมูลที่ไม่ compatible

## 11. เงื่อนไขผ่านก่อนเปิดใช้งานจริง

- [ ] ทุกเมนูมีเจ้าของโมดูลและเจ้าของข้อมูลชัดเจน
- [ ] ทุก API action มี contract และ permission matrix
- [ ] ทุกข้อมูลหลักใช้ stable ID เดียวกันทุกแอป
- [ ] ทดสอบ Branch Isolation: ผู้ใช้สาขา A มองไม่เห็นข้อมูลสาขา B
- [ ] ทดสอบ Role Isolation: Staff ไม่สามารถเรียก API ระดับ Manager/HR/Owner ได้
- [ ] ทดสอบการอนุมัติซ้ำ/ส่งคำขอซ้ำด้วย idempotency
- [ ] ทดสอบข้อมูลเปลี่ยนจากแอปหนึ่งแล้วทุกแอปเห็นสถานะที่ถูกต้อง
- [ ] ทดสอบ Audit ว่าตรวจย้อนหลังได้ว่าใครแก้จากแอปไหน
- [ ] ทดสอบ regression ของ Schedule, Attendance, Leave, OT, Approval, Payroll, HR Documents
- [ ] ทดสอบมือถือ/iPad/PC และ LINE/LIFF แยกกัน
- [ ] มี backup, migration plan, rollback plan และ monitoring

## 12. สิ่งที่ยังไม่ทำในรอบ Blueprint

- ไม่สร้างแอปใหม่และไม่ย้ายไฟล์จริง
- ไม่เปลี่ยนตารางหรือข้อมูล Supabase
- ไม่เปลี่ยน API, Edge Function, RLS หรือ permission จริง
- ไม่แก้ business rules และไม่เปลี่ยน UX ที่ผู้ใช้ใช้งานอยู่
- ไม่แตะ Customer Order / Customer LINE OA / Customer LIFF flows

เหตุผล: ต้องจบ Inventory + Data Dictionary + Dependency Map ก่อน เพื่อป้องกันการแยกแอปแล้วข้อมูลซ้ำ สิทธิ์หลุด หรือ workflow เดิมเสีย


---

# Architecture Addendum — LINE OA, LIFF, Live Orders & Product Operations

วันที่เพิ่มเติม: 20 พ.ย. 2569  
สถานะ: เพิ่มขอบเขตตามคำสั่งผู้ใช้ / Blueprint เท่านั้น ยังไม่แก้ Production

## 13. ขอบเขตระบบที่เพิ่มเข้ามา

นอกเหนือจาก 5 แอปตามบทบาท ให้แยกช่องทางและระบบปฏิบัติการต่อไปนี้เป็น Application/Module ที่มี Source Code, UI, release, test และการตั้งค่าของตัวเอง โดยเชื่อมข้อมูลผ่าน Shared API และฐานข้อมูลกลางเดียวกัน

1. **LINE OA — Order Channel:** จัดการ OA สำหรับรับคำสั่งซื้อ เมนู Rich Menu, Messaging, Webhook, Template/ข้อความ, Channel Settings, Token/Connection Status และการติดตามเหตุการณ์
2. **LINE OA — Staff Channel:** จัดการ OA/ช่องทางสื่อสารพนักงาน แยกจาก Order OA ทั้ง Channel ID, Rich Menu, Webhook, Messaging Rules, Notification และสิทธิ์ผู้ดูแล
3. **Customer Order LIFF:** หน้าสั่งซื้อของลูกค้าผ่าน LINE LIFF รวม Login/Identity Mapping, Catalog, Cart, Checkout, Order Status และการเลือกสาขา
4. **Staff LIFF:** หน้าสำหรับพนักงานผ่าน LINE LIFF เช่น Today, Schedule, Clock/Attendance, Leave/OT Request, Notifications และ Profile โดยใช้ Staff Identity กลาง
5. **Live Order Management:** ระบบรับออเดอร์แบบ real-time, Order Queue, สถานะ, การรับงาน, การจัดเตรียม, พร้อมรับ/ส่งมอบ, ยกเลิก, ประวัติ และการติดตามปัญหา
6. **Product Management:** จัดการ Product Master, หมวดหมู่, รูปภาพ, ราคา, ตัวเลือก/Modifiers, Availability, สถานะขาย, การผูกสินค้าเข้ากับสาขา และประวัติการเปลี่ยนแปลง
7. **Channel & Integration Management:** หน้าจัดการการเชื่อมต่อ LINE OA/LIFF, webhook endpoints, channel mapping, event delivery, retry queue, health check และ audit

Customer Order LIFF และ LINE OA Order ที่ระบุข้างต้นเป็นส่วนหนึ่งของขอบเขตงานแล้ว ไม่ถือเป็นระบบที่ยกเว้นอีกต่อไป

## 14. โครงสร้าง Application ใหม่

โครงสร้างเป้าหมายขยายจาก 5 role apps เป็นชุดแอปที่ deploy และแก้ไขแยกกัน:

```
apps/
  owner/
  manager/
  hr/
  staff/
  super-admin/

  order-liff/            # Customer ordering LIFF
  staff-liff/            # Staff LIFF
  live-orders/           # Live Order operations console
  product-management/    # Product/catalog operations
  line-order-admin/      # LINE OA Order management
  line-staff-admin/      # LINE OA Staff management
  integration-center/    # LINE/LIFF/webhook integration console

packages/
  api-client/
  contracts/
  identity/
  permissions/
  domain-types/
  audit-client/
  event-client/
  ui-foundation/
  line-sdk-adapter/
  liff-sdk-adapter/
  order-contracts/
  catalog-contracts/

services/
  api-gateway/
  domains/
    identity/
    organization/
    employee/
    schedule/
    attendance/
    leave/
    approval/
    product-catalog/
    inventory/
    order/
    order-fulfillment/
    payroll/
    accounting/
    notification/
    documents/
    reporting/
    line-channel/
    liff-session/
    webhook-ingestion/
  integrations/
    line-order/
    line-staff/
    external-systems/

supabase/
  migrations/
  functions/
    backoffice/
    order-api/
    line-order-webhook/
    line-staff-webhook/
    liff-session/
    hr-documents/
    it-monitor/
```

โครงสร้างนี้เป็น logical target ไม่ได้หมายความว่าต้องสร้าง Edge Function ทุกตัวทันที บริการใดควรแยกเป็น function หรือยังคงอยู่ใน backoffice เดิมต้องตัดสินจาก inventory, security boundary, traffic และ dependency จริง

## 15. หน้าที่และขอบเขตของระบบ Order / Product / LINE

### 15.1 Customer Order LIFF
- ลูกค้าเข้าสู่ LIFF และผูก LINE identity กับ customer record ตามกติกาความยินยอม
- เลือกสาขาและดูเฉพาะสินค้าที่เปิดขายในสาขานั้น
- แสดงราคา ตัวเลือกสินค้า และ availability จาก Catalog API กลาง
- สร้าง Cart และส่งคำสั่งซื้อผ่าน Order API กลาง
- แสดงเลขคำสั่งซื้อและสถานะจาก Order Lifecycle กลาง
- ป้องกันการกดสั่งซ้ำด้วย idempotency key
- ไม่เก็บ catalog/order state แยกไว้ใน LIFF เป็นแหล่งข้อมูลจริง

### 15.2 Live Order Management
- แสดงคิวออเดอร์แบบ real-time ตามสาขาและสิทธิ์
- กำหนดสถานะมาตรฐาน เช่น received, accepted, preparing, ready, completed, cancelled (ต้องเทียบกับสถานะเดิมก่อนใช้จริง)
- เก็บ Order Status History ทุก transition
- แจ้งสถานะกลับไปยัง Customer LIFF/LINE OA ผ่าน Notification/Event Service
- รองรับ reconnect, retry และ reconciliation เมื่อ realtime หลุด
- แยกสิทธิ์ดู/รับงาน/เปลี่ยนสถานะ/ยกเลิกตาม Role และ Branch Scope
- การเปลี่ยนสถานะต้องทำผ่าน server-side transition validation เท่านั้น

### 15.3 Product Management
- Product Master กลางเป็นแหล่งข้อมูลจริง
- จัดการ Category, Product Options, Option Groups และ Combinations
- แยกข้อมูลระดับสินค้าออกจากการเปิดขายรายสาขา เช่น branch_products
- รองรับราคาและสถานะที่มีผลตามสาขา หากระบบเดิมมีข้อกำหนดดังกล่าว
- จัดการรูปภาพผ่าน Storage และใช้ stable asset reference
- เก็บ Product Change Audit และผู้แก้ไข
- Order ต้องบันทึก snapshot ชื่อสินค้า ราคา ตัวเลือก และข้อมูลที่จำเป็น ณ เวลาสั่งซื้อ เพื่อรักษาประวัติ แม้ Catalog ภายหลังเปลี่ยนไป

### 15.4 LINE OA Order Administration
- จัดการการเชื่อมต่อ OA Order โดยใช้ Channel ID กลาง
- ตั้งค่า Rich Menu / Menu Version / URI / LIFF destination
- จัดการข้อความตอบกลับและ template ตามสิทธิ์
- ตรวจสอบ webhook delivery, error, retry และ duplicate event
- ผูก LINE user กับ Customer ID ตามกติกา Identity Mapping
- ห้ามแสดง Channel Access Token หรือ Channel Secret ใน UI/log และห้ามเก็บใน Source Code

### 15.5 LINE OA Staff Administration
- แยก Channel Configuration และ Rich Menu จาก Order OA โดยเด็ดขาด
- จัดการข้อความประกาศและ notification พนักงาน
- ผูก LINE identity กับ Staff ID โดยผ่านขั้นตอนยืนยันตัวตน
- ตรวจสอบสถานะ webhook, push delivery และข้อผิดพลาด
- จำกัดผู้ดูแลตาม Role และบันทึก Audit ทุกการเปลี่ยนค่า

### 15.6 Staff LIFF
- ใช้ Staff Identity กลางเดียวกับ Staff App
- ตารางงาน เวลาเข้าออก คำขอลา/OT และ notification ต้องอ่านจาก Domain API เดียวกัน
- ห้ามสร้าง Employee/Attendance/Schedule record ซ้ำเฉพาะใน LIFF
- คงกติกาพนักงานยื่น OT เอง และ flow การอนุมัติเดิม

## 16. Data Ownership และการเชื่อมโยงข้ามระบบ

| Domain / ข้อมูล | Source of Truth | ผู้สร้าง/แก้ไขตามสิทธิ์ | ผู้ใช้ข้อมูล |
|---|---|---|---|
| Customer Identity | Customer Domain | ระบบ/ผู้ได้รับอนุญาต | Order LIFF, LINE OA Order, Live Orders, Owner |
| LINE Identity Mapping | Identity Integration Domain | ระบบหลังยืนยันตัวตน/ผู้ดูแลที่ได้รับอนุญาต | Customer LIFF, Staff LIFF, OA integrations |
| LINE Channel Config | Channel Integration Domain | Super Admin/ผู้ดูแล Channel | LINE OA Order, LINE OA Staff, LIFF |
| Product / Category / Options | Product Catalog Domain | Product Admin/ผู้ได้รับอนุญาต | Order LIFF, Live Orders, Owner, Manager |
| Branch Product Availability | Branch Catalog Domain | ผู้ดูแลสินค้า/สาขาตามสิทธิ์ | Customer LIFF, Live Orders, Manager |
| Order / Order Items | Order Domain | Customer LIFF สร้าง; ระบบ/ผู้มีสิทธิ์เปลี่ยนสถานะ | Live Orders, Owner, Manager, LINE OA |
| Order Status History | Order Domain | Order workflow service เท่านั้น | ทุกแอปที่มีสิทธิ์ |
| Fulfillment / Preparation | Fulfillment Domain | พนักงาน/ผู้จัดการตามสิทธิ์ | Live Orders, Customer LIFF, LINE OA |
| Staff Identity | Employee/Identity Domain | HR/Super Admin ตามสิทธิ์ | Staff App, Staff LIFF, Mgr, HR, Owner |
| Staff Schedule/Attendance | Workforce Domain | Staff/Mgr/HR ตาม workflow | Staff LIFF, Staff App, Mgr, HR, Owner |
| Notifications | Notification Domain | Event consumers | ทุกแอปและ LINE channels ตาม permission |

**ข้อห้าม:** ห้ามให้ LINE OA, LIFF หรือ Live Orders ทำสำเนาสินค้า/ราคา/ออเดอร์เป็นฐานข้อมูลหลักของตัวเอง ทุกช่องทางต้องอ้างอิง Product ID, Branch ID, Customer ID และ Order ID ชุดเดียวกัน

## 17. Event Flow ที่ต้องทำงานเชื่อมโยงกัน

### Order Flow
```
Customer LINE OA
      ↓ open LIFF
Customer Order LIFF
      ↓ Catalog API
Shared Product / Branch Catalog
      ↓ create order
Shared Order API + PostgreSQL
      ↓ OrderCreated Event
Live Order Management
      ↓ status transition
Order Status History
      ↓ OrderStatusChanged Event
Customer LIFF + LINE OA Notification
      ↓
Customer sees the same order status
```

### Staff Flow
```
HR Employee Master
      ↓
Shared Staff Identity
      ↓
Staff App  ↔  Staff LIFF
      ↓              ↓
Schedule / Attendance / Leave / OT APIs
      ↓
Approval Workflow (Mgr / HR / Owner as authorized)
      ↓
Shared Status + Audit + Notification
      ↓
All authorized apps show the same current state
```

### Product Update Flow
```
Product Management
      ↓
Product Catalog Domain
      ↓
Branch Availability / Price / Options
      ↓ CatalogChanged Event
Customer Order LIFF + Live Orders + Owner + Manager
      ↓
All channels read the current catalog from the same API
```

ทุก Event ต้องมี event_id, aggregate_id, aggregate_version, occurred_at, source_app, actor_id และ correlation_id; consumer ต้อง idempotent และมี retry/dead-letter/reconciliation

## 18. LINE / LIFF Security & Reliability Requirements

- Verify LINE webhook signature ฝั่ง server ก่อนประมวลผล
- แยก secrets ของ Order OA และ Staff OA; จัดเก็บใน Secret Store/Environment ที่ปลอดภัยเท่านั้น
- ไม่ส่ง Channel Secret, Access Token หรือข้อมูลลับลง browser, repository, logs หรือ error message
- LIFF ต้องตรวจสอบ session/token ฝั่ง server และผูก user identity ตาม flow ที่กำหนด
- ตรวจสิทธิ์ทุก API request ไม่เชื่อค่า role หรือ branch จาก client
- ป้องกัน webhook replay/duplicate ด้วย event identity และ idempotency
- แยก webhook endpoint หรือ routing namespace ระหว่าง Order OA กับ Staff OA
- บันทึก webhook receipt, processing result, retry count และ correlation ID โดยไม่บันทึกข้อมูลลับ
- จำกัดข้อมูลลูกค้าและข้อมูลพนักงานตามวัตถุประสงค์และสิทธิ์
- มีระบบตรวจ health ของ OA/LIFF, callback, API, realtime และ notification delivery

## 19. การแยก Release และการทดสอบเพิ่มเติม

แต่ละ Application ต้องมี pipeline ของตนเอง:
- Owner, Manager, HR, Staff, Super Admin
- Customer Order LIFF, Staff LIFF
- Live Order Management, Product Management
- LINE OA Order Admin, LINE OA Staff Admin, Integration Center

การเปลี่ยน Shared API หรือ Database Contract ต้องมี:
1. Contract version / migration plan
2. Compatibility test กับ client ทุกตัวที่ใช้งาน
3. Integration test สำหรับ Order → Live Order → Notification → LIFF
4. Integration test สำหรับ Product → Branch Availability → Order LIFF
5. Integration test สำหรับ HR/Staff → Staff LIFF → Attendance/Leave/OT → Approval
6. Webhook signature, duplicate event, retry และ recovery test
7. Branch/Role isolation test
8. Rollback plan ที่ไม่ทำให้ order history หรือ audit สูญหาย

## 20. ปรับขอบเขตการดำเนินงาน

- รวม Customer Order LIFF, LINE OA Order และ Staff LIFF/LINE OA Staff ไว้ในแผนแยกระบบอย่างเป็นทางการ
- รวม Live Order Management และ Product Management เป็นแอป/โมดูลที่มีขอบเขต Source Code ชัดเจน
- ไม่แยกฐานข้อมูลธุรกิจตามแอป และไม่สร้าง Product/Order/Staff/Branch master ซ้ำ
- ใช้ Supabase Project เดิมเป็นฐานข้อมูลกลางในระยะแรก
- คง customer ordering workflow และ staff workflow เดิม จนกว่าจะทำ inventory และ regression test ผ่าน
- ยังไม่เปลี่ยน schema, RLS, webhook, LIFF settings, LINE OA credentials หรือ production endpoints ในรอบเอกสารนี้
