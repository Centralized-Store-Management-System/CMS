# IT Report: ปัญหาหน้า Login แสดงแทรกระหว่างกำลังทำงาน

วันที่ตรวจสอบ: 19 พ.ย. 2569  
ระบบที่ตรวจ: Owner Console / Owner PWA / Back Office  
ไฟล์ต้นเหตุ: `js/owner-pwa-lock.js`, `js/owner.js`

## อาการ
ระหว่างเปิดระบบหรือทำรายการต่อเนื่อง มีหน้า Sign in / Login ถูกวาดขึ้นมาชั่วขณะ ทั้งที่ระบบกำลังตรวจสอบหรือปลดล็อก session อยู่ ทำให้ผู้ใช้เข้าใจว่าถูกออกจากระบบ และเห็นหน้าที่ไม่เกี่ยวกับงานปัจจุบัน

## สาเหตุจากโค้ดที่ตรวจพบ
1. ตัวครอบ `renderLogin()` ใน `js/owner-pwa-lock.js` เรียกหน้า Login เดิม (`login0(msg)`) ก่อนเริ่ม `unlockFlow()` แบบ asynchronous จึงเกิดการวาดหน้า Login ก่อนหน้าปลดล็อกจะขึ้นทับ
2. `unlockFlow()` เดิมไม่รวมคำขอปลดล็อกที่เกิดพร้อมกัน หากมีหลายจุดเรียกพร้อมกัน คำขอที่มาทีหลังอาจได้รับผลลัพธ์ `false` ทั้งที่คำขอแรกยังทำงานอยู่
3. `ocGo()` ใน `js/owner.js` ส่งทั้ง `SESSION` และ `PERM` ไปหน้า `ocLogin()` ทันที ซึ่งไม่ถูกต้องสำหรับกรณีไม่มีสิทธิ์ (`PERM`) และทำให้หน้า Login แทรกขึ้นระหว่างทำงานเมื่อ session มีปัญหาชั่วคราว

## Function / API ที่เกี่ยวข้องและต้องเชื่อมต่อ
API หลักของระบบ: Supabase Edge Function `backoffice` ผ่าน `AMZ_API` และ `API.call(action, params)`

| กลุ่ม | Action / Function | วัตถุประสงค์ |
|---|---|---|
| Authentication | `login` | ตรวจ Username + PIN และเริ่มขั้นยืนยันตัวตน |
| Authentication | `auth2` | ดำเนินการยืนยันขั้นที่ 2 เช่น TOTP, LINE polling หรือ Passkey |
| Session | `me` | ตรวจสอบ session และข้อมูลบัญชี Owner |
| Session | `logout` | จบ session |
| Owner device lock | `devReg` | ผูกอุปกรณ์ Owner ครั้งแรก (`app: 'owner'`) |
| Owner device lock | `devUnlock` | ตรวจรหัสปลดล็อก/กุญแจอุปกรณ์และออก session ใหม่ |
| Owner device lock | `devForget` | ยกเลิกการผูกอุปกรณ์ |
| Owner Console | `it` + `op: status` | ตรวจสุขภาพระบบ |
| Owner Console | `it` + `op: dash` | ดึง Dashboard ปัญหารายวัน |
| Owner Console | `it` + `op: perf` | ดึงข้อมูลประสิทธิภาพ |
| Owner Console | `it` + `op: events` | ดึงเหตุการณ์ระบบ |
| Owner Console | `it` + `op: authList` | อ่านวิธีเข้าระบบของบัญชี |
| Owner Console | `it` + `op: healAll` | สั่งซ่อมรายการที่ระบบรองรับ |
| Owner Console | `it` + `op: heal` | สั่งซ่อมตามรหัสคำสั่ง |
| Owner Console | `it` + `op: authSet` | บันทึกวิธีเข้าระบบ/ล้างการผูก |
| Branch data | `staff` | อ่านรายการสาขาที่ Owner Console ใช้แสดงทางเข้าร้าน |
| Order SSO (แยกเส้นทาง) | `orderTicket` | ขอ SSO ticket เพื่อเปิด Line-Order; ticket มีอายุสั้น แล้วส่งต่อไปตรวจสิทธิ์ใน Line-Order |

### ลำดับการเชื่อมต่อที่ถูกต้อง
- เปิด Owner PWA ที่ผูกอุปกรณ์แล้ว: `devUnlock` → รับ session → `me` / `it` actions ตามเมนู โดยไม่ย้อนกลับไปแสดง Login ระหว่างรอ
- เปิดครั้งแรก: `login` → `auth2` ตามวิธีที่กำหนด → `devReg` เพื่อผูกอุปกรณ์ → ตั้งรหัสปลดล็อก
- เปิด Back Office จาก Owner PWA: ส่ง session ผ่าน session storage → หาก session หมดอายุ ให้ลองต่ออายุผ่าน `devUnlock` ก่อนแสดงทางเลือก Login
- เปิด Order System: `orderTicket` → SSO ticket → Line-Order ตรวจสิทธิ์ของตนเอง

## การแก้ไขที่ทำ
1. เปลี่ยนลำดับการทำงานของตัวครอบ `renderLogin()`: หากเป็น Owner PWA ที่มี vault จะเริ่มปลดล็อกก่อน และไม่วาดหน้า Login ระหว่างรอ
2. รวมคำขอ `unlockFlow()` ที่เกิดพร้อมกันเป็น Promise เดียว ลด race condition และการแสดงหน้าซ้ำ
3. แก้ `ocGo()`: `PERM` แสดงข้อความแจ้งสิทธิ์ในหน้าปัจจุบัน ไม่พาไป Login; `SESSION` คง Owner Console ไว้และให้ผู้ใช้กดเชื่อมต่อ/เข้าสู่ระบบใหม่เอง
4. เพิ่ม cache-busting version ของ `owner-pwa-lock.js` ใน `owner.html` และ `index.html` เป็น `2.1.2`

## ขอบเขตและข้อควรทราบ
- รอบนี้แก้เฉพาะ Front-end flow; ไม่แก้ Edge Function หรือ server source เพราะ server business logic อยู่ใน `server/gas.enc` ที่เข้ารหัส และต้นฉบับอยู่นอก repository
- ไม่เปลี่ยนเงื่อนไขสิทธิ์, อายุ session, วิธี Authenticator, LINE/LIFF หรือระบบ Mgr/Staff
- การแก้ไขนี้ป้องกันหน้า Login แทรกขึ้นโดยไม่ตั้งใจ แต่ไม่ได้ปิดบังการหมดอายุ session จริง หากต่ออายุไม่สำเร็จ ผู้ใช้ยังสามารถเลือกเข้าสู่ระบบใหม่ได้จากปุ่มบนหน้าเดิม

## Checklist ให้ IT ทดสอบ
1. Owner PWA เปิดแอปและปลดล็อกด้วย PIN: ต้องไม่เห็นหน้า Login แทรกก่อนหรือระหว่างปลดล็อก
2. จำลอง session หมดอายุขณะเปิด Dashboard / ตรวจระบบ / เหตุการณ์: ต้องพยายามต่ออายุ และคงหน้า Owner Console ระหว่างดำเนินการ
3. จำลอง `PERM`: ต้องแสดงข้อความไม่มีสิทธิ์ในหน้าเดิม ไม่เปิด Login
4. กดปุ่มเชื่อมต่อใหม่: Owner PWA ต้องเรียกขั้นปลดล็อก; เว็บปกติจึงค่อยเปิด Login เมื่อผู้ใช้กดเอง
5. ทดสอบเข้าเมนู Order System ผ่าน `orderTicket` และยืนยันว่า SSO ไม่ถูกกระทบ
6. ทดสอบบน iPhone / Android จริง รวมถึงเปิดแอปจาก background และเครือข่ายที่ช้าหรือขาดช่วง

สถานะ: แก้ไขและ commit ฝั่ง Front-end แล้ว; ยังต้องทดสอบบนอุปกรณ์จริงก่อนปิดงาน IT
