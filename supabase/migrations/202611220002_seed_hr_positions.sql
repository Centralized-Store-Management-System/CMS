-- Seed the current legacy roles plus requested Finance positions.
insert into public.hr_positions(position_code,name_th,name_en,department,level,description)
values
 ('MANAGER','ผู้จัดการร้าน','Store Manager','Operations','Management','บริหารการดำเนินงานสาขา'),
 ('ASST_MANAGER','ผู้ช่วยผู้จัดการ','Assistant Store Manager','Operations','Supervisory','สนับสนุนการบริหารสาขา'),
 ('BARISTA','บาริสต้า','Barista','Operations','Staff','ปฏิบัติงานเครื่องดื่มและบริการ'),
 ('CASHIER','แคชเชียร์','Cashier','Operations','Staff','ดูแลแคชเชียร์และรับชำระเงิน'),
 ('PARTTIME','พาร์ทไทม์','Part-time','Operations','Staff','พนักงานรายชั่วโมง'),
 ('FINAL_VERIFIER','Final Verifier','Final Verifier','Finance','Financial Control','ตรวจสอบความครบถ้วนทางการเงินขั้นสุดท้ายโดยอิสระ'),
 ('ACCOUNTING','Accounting','Accounting','Finance & Accounting','Accounting Operations','จัดทำบัญชีและดูแลการเงิน')
on conflict(position_code) do update set name_th=excluded.name_th,name_en=excluded.name_en,department=excluded.department,level=excluded.level,description=excluded.description,updated_at=now();
