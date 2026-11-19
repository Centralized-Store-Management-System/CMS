# server/ — ระบบหลังร้านบน Supabase

- `runtime.js` ตัวรันโค้ด Apps Script บน Supabase Edge Function (แทนบริการของ Google ด้วย Postgres + Storage)
- `store-pg.js` ที่เก็บข้อมูล (schema `backoffice`)
- `gas.enc` โค้ดระบบทั้งหมด (gas/*.gs) แบบเข้ารหัส AES-256-GCM — ถอดได้เฉพาะ Edge Function (กุญแจอยู่ในฐานข้อมูล)

อัปไฟล์ `gas.enc` ใหม่ → ระบบใช้โค้ดใหม่เองภายใน 1 นาที
