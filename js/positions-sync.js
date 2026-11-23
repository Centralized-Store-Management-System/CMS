/* ทะเบียนตำแหน่ง (Position Master) — โหลดครั้งเดียว ใช้ร่วมกันทุกหน้า
 *
 * ปัญหาเดิม: HR_POSITIONS ตั้งต้นเป็นรายการสำรองที่เขียนไว้ในโค้ด (5 ตำแหน่ง ไม่มี Final Verifier)
 *   และจะถูกแทนที่ด้วยของจริงก็ต่อเมื่อ "เปิดหน้า HR" เท่านั้น (js/mod-hr.js, js/perms-positions.js)
 *   หน้าอื่นที่ใช้รายการตำแหน่ง (ใยแมงมุม · ตรวจรหัสตำแหน่ง · ตารางงาน) จึงเห็นคนละชุดกัน
 *   → เปิดหน้า A เห็น 5 ตำแหน่ง เปิด HR แล้วกลับมาเห็น 6 ตำแหน่ง = "ระบบไม่ซิงก์กัน"
 *   รหัสตำแหน่งก็คนละชุด (ของสำรองเป็น legacy-xxx ของจริงเป็น UUID) สิ่งที่ผูกด้วยรหัสจึงเพี้ยนตาม
 *
 * ไฟล์นี้แก้ที่ต้นเหตุ: โหลดทะเบียนจริงให้เสร็จตั้งแต่เข้าสู่ระบบ แล้วบอกทุกหน้าว่าโหลดแล้ว
 *   (ตั้ง HR_POSITION_LOADED ให้ของเดิมไม่โหลดซ้ำ) · ไม่แก้ไฟล์เดิม ใช้ได้ทั้งเว็บหลังร้านและแอป Owner
 */
'use strict';
(function () {
  const API_POS = (typeof AMZ_API === 'string' && AMZ_API ? AMZ_API.replace(/\/[^/]*$/, '/hr-position-api') : '');
  let job = null, doneFor = '';

  /* เว็บหลังร้านประกาศตัวแปรเหล่านี้ไว้แล้วด้วย let (mod-hr.js) แอป Owner ยังไม่มี
   * เขียนตรงๆ ก่อน ถ้าไม่มีตัวแปร (ReferenceError) จึงค่อยสร้างไว้บน window */
  const setPositions = v => { try { HR_POSITIONS = v; } catch (e) { window.HR_POSITIONS = v; } };
  const setDepts = v => { try { HR_DEPARTMENTS = v; } catch (e) { window.HR_DEPARTMENTS = v; } };
  const setSync = v => { try { HR_POSITION_SYNC = v; } catch (e) { window.HR_POSITION_SYNC = v; } };
  const setErr = v => { try { HR_POSITION_ERROR = v; } catch (e) { window.HR_POSITION_ERROR = v; } };
  const setLoaded = v => { try { HR_POSITION_LOADED = v; } catch (e) { window.HR_POSITION_LOADED = v; } };
  const setLoading = v => { try { HR_POSITION_LOADING = v; } catch (e) { window.HR_POSITION_LOADING = v; } };
  const getPositions = () => (typeof HR_POSITIONS !== 'undefined' ? HR_POSITIONS : []);

  async function fetchPositions() {
    if (!API_POS) throw new Error('ยังไม่ได้ตั้งค่าที่อยู่ API');
    const r = await fetch(API_POS, { headers: { 'content-type': 'application/json', 'x-cms-session': (typeof S !== 'undefined' && S.token) || '' }, cache: 'no-store' });
    const p = await r.json().catch(() => ({}));
    if (!r.ok || !p.ok) throw new Error(p.error || 'โหลดทะเบียนตำแหน่งไม่สำเร็จ');
    if (!Array.isArray(p.positions)) throw new Error('Position API ส่งข้อมูลไม่ถูกต้อง');
    return p;
  }

  /** โหลดทะเบียนตำแหน่งให้พร้อมใช้ · เรียกซ้ำได้ จะรอรอบเดิม ไม่ยิงซ้ำ */
  window.posEnsure = function posEnsure(force) {
    const tok = (typeof S !== 'undefined' && S.token) || '';
    if (!force && doneFor && doneFor === tok) return Promise.resolve(getPositions());
    if (job) return job;
    setLoading(true);
    job = fetchPositions().then(p => {
      setPositions(p.positions);
      setDepts(Array.isArray(p.departments) ? p.departments : []);
      setSync(Array.isArray(p.sync) ? p.sync : []);
      setErr('');
      doneFor = tok;
      return p.positions;
    }).catch(e => {
      /* โหลดไม่ได้: ปล่อยให้รายการสำรองเดิมทำงานต่อ แต่บอกไว้ว่าไม่ใช่ของจริง */
      setErr(e.message || 'โหลดทะเบียนตำแหน่งไม่สำเร็จ');
      return getPositions();
    }).finally(() => {
      setLoaded(true);
      setLoading(false);
      job = null;
      if (typeof App !== 'undefined' && App && typeof App.render === 'function') {
        try { App.render(); } catch (e) { /* หน้ายังไม่พร้อมวาด */ }
      }
    });
    return job;
  };

  /* โหลดอัตโนมัติทันทีที่เข้าสู่ระบบ — ทุกหน้าได้ชุดเดียวกันโดยไม่ต้องเปิด HR ก่อน */
  setInterval(() => {
    if (document.hidden || job) return;
    const tok = (typeof S !== 'undefined' && S.token) || '';
    if (!tok || tok === doneFor) return;
    posEnsure();
  }, 700);
})();
