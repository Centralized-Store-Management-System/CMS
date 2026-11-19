/* ระบบออเดอร์ (Line-Order) ในเมนูหลังร้าน — บัญชีเดียวกัน เข้าระบบอัตโนมัติ ตามสิทธิ์ (54_OrderLink.gs · server/order-link.js)
 * - เว็บหลังร้าน (index.html): กลุ่มเมนู "Order System" → จัดการออเดอร์ LIVE (สิทธิ์ orders) · Web Admin Portal (สิทธิ์ catalog)
 * - แอปพนักงาน (clock.html): ปุ่ม "ออเดอร์" มุมบนเมื่อมีสิทธิ์ (ไม่แสดงใน LINE)
 * - แอป Owner (owner.html): ปุ่ม "ระบบออเดอร์" หน้าหลัก → เข้าผ่านหลังร้าน
 * กดแล้วขอตั๋วครั้งเดียวจากระบบ → เปิดแท็บใหม่ → เข้าระบบออเดอร์เลย ไม่ต้องใส่อีเมล/รหัสผ่าน */
'use strict';
(function () {
  const PAGES = { orders: 'จัดการออเดอร์ LIVE', catalog: 'Web Admin Portal' };
  if (typeof IC === 'object') {
    IC.orders = '<path d="M3.5 4.5h2l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>';
    IC.catalog = '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8.5" cy="8.5" r="1.6"/>';
  }
  /** เปิดระบบออเดอร์: เปิดแท็บก่อน (กันเบราว์เซอร์บล็อก) แล้วค่อยใส่ที่อยู่เมื่อได้ตั๋ว */
  async function openOrder(page, btn) {
    const w = window.open('', '_blank');
    try { if (w) w.document.write('<p style="font:16px sans-serif;padding:24px;color:#2F7D55">กำลังเปิด ' + PAGES[page] + '…</p>'); } catch (e) { /* */ }
    try {
      const r = await busy(btn, () => API.call('orderTicket', { t: S.token, page }), 'กำลังเปิด…');
      if (w && !w.closed) w.location.href = r.url; else location.href = r.url;
    } catch (e) { if (w) w.close(); toast(e.message); }
  }
  window.openOrder = openOrder;
  const hasRef = () => !!S.me && (S.me.role === 'owner' || !!S.me.uid);

  /* ---------- เว็บหลังร้าน ---------- */
  if (typeof defMod === 'function' && typeof GROUPS !== 'undefined') {
    const card = page => `<div class="group pad"><p style="margin-top:0">${page === 'orders'
      ? 'รับออเดอร์จาก LINE / เว็บ ยืนยัน เตรียม ส่ง พร้อมแผนที่ลูกค้า แบบ LIVE'
      : 'จัดการสินค้า หมวดหมู่ ตัวเลือก ราคาและการเปิดขายรายสาขา นำเข้าไฟล์'}</p>
      <p class="muted">ใช้บัญชีเดียวกับหลังร้าน กดแล้วเข้าระบบให้อัตโนมัติ (แท็บใหม่)</p>
      ${hasRef() ? `<button class="btn primary big" data-a="orderOpen:${page}">เปิด ${PAGES[page]}</button>` : '<p class="note bad">ต้องมีบัญชีผู้ใช้ (Users) ที่เปิดใช้งานแล้ว ติดต่อ Owner/Admin</p>'}</div>`;
    defMod({ key: 'orders', mod: 'stock', label: 'Live Orders', icon: 'orders', desc: 'ระบบออเดอร์ · รับและจัดการออเดอร์', perm: ['orders'], noBranch: true, view: () => card('orders'), summary: () => 'รับออเดอร์ LINE / เว็บ แบบ LIVE' });
    defMod({ key: 'catalog', mod: 'stock', label: 'Web Admin Portal', icon: 'catalog', desc: 'ระบบออเดอร์ · สินค้า ราคา เปิดขาย', perm: ['catalog'], noBranch: true, view: () => card('catalog'), summary: () => 'สินค้า หมวดหมู่ ราคา เปิดขายรายสาขา' });
    const at = GROUPS.findIndex(g => g[0] === 'Operations');
    GROUPS.splice(at + 1, 0, ['Order System', ['orders', 'catalog']]);
    NAV_ORDER.splice(0, NAV_ORDER.length, ...GROUPS.flatMap(g => g[1]));
    Object.assign(ACT, { orderOpen: (a, b) => openOrder(a, b) });
    // กดเมนูแล้วเปิดระบบออเดอร์เลย (หน้าในหลังร้านเป็นทางสำรอง)
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href="#orders"],a[href="#catalog"]');
      if (!a || !hasRef() || e.metaKey || e.ctrlKey) return;
      e.preventDefault(); openOrder(a.getAttribute('href').slice(1), null);
    }, true);
  }

  /* ---------- แอปพนักงาน ---------- */
  if (typeof CACT === 'object' && typeof render === 'function') {
    const r0 = render;
    const add = () => {
      const L = (C.my && C.my.orderLinks) || [], top = document.querySelector('.clock-top');
      if (!L.includes('orders') || !top || !S.token || C.via === 'line' || top.querySelector('[data-order]')) return;
      const b = document.createElement('button');
      b.className = 'btn sm'; b.dataset.order = 'orders'; b.type = 'button'; b.textContent = '🛒 ออเดอร์'; b.style.marginRight = '6px';
      b.onclick = () => openOrder('orders', b);
      top.insertBefore(b, top.lastElementChild);
    };
    window.render = render = function () { r0.apply(this, arguments); add(); };
    add();
  }

  /* ---------- แอป Owner ---------- */
  if (typeof ocLanding === 'function') {
    const l0 = ocLanding;
    const add = () => {
      const m = document.querySelector('.oc-land-menu');
      if (m && !m.querySelector('[data-order]')) m.insertAdjacentHTML('beforeend', `<a class="oc-big" data-order="1" href="index.html?from=owner#orders"><span class="ic">${icon('orders')}</span><b>ระบบออเดอร์</b><small>จัดการออเดอร์ LIVE · สินค้า ราคา (Web Admin Portal)</small></a>`);
    };
    window.ocLanding = ocLanding = function () { l0.apply(this, arguments); add(); };
    add();
  }
})();
