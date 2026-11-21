# Finance & Accounting Module

สถานะ: Foundation only — ยังไม่เชื่อม Owner Portal, ยังไม่เชื่อมฐานข้อมูล และยังไม่เปิดใช้งานจริง

## Purpose
โมดูลบัญชี การเงิน และภาษีภายใต้ CMS โดยแยก UI, assets, API, database schema และ background processing จากระบบเดิม

## Non-negotiable isolation rules
1. ห้าม import ไฟล์ JS/CSS ของ Finance จาก `index.html`, `owner.html`, `clock.html` หรือ `line.html` ในช่วง foundation
2. ห้ามแก้ `js/core.js`, `js/config.js`, `js/auth-web.js`, `js/owner.js`, shared CSS, encrypted server payload หรือ Edge Function `backoffice`
3. ห้ามสร้าง trigger หรือ synchronous dependency กับตารางเดิม
4. ห้ามใช้ credentials/secrets ใน frontend
5. ห้ามใช้ production data ในการทดสอบ
6. ยังไม่สร้าง migration หรือ Edge Function ที่ deploy ได้จนกว่าจะตรวจสอบ Supabase schema และ auth contract

## Planned layout
- `finance.html` — independent entry point (later phase)
- `css/` — module-only styles
- `js/` — module-only scripts
- `components/` — reusable Finance-only UI components
- `services/` — API adapters, lazy loaded
- `tests/` — isolated unit and integration tests

## Access model
- Owner
- Accounting

## Current state
This directory intentionally contains only architecture scaffolding. No Finance code is loaded by existing applications.
