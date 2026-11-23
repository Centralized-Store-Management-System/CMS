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
  const isCmsOwner = () => !!S.me && S.me.role === 'owner';
  let ownerFrameRequest = 0;

  function installOwnerOrdersStyles() {
    if (document.getElementById('cms-owner-orders-style')) return;
    const style = document.createElement('style');
    style.id = 'cms-owner-orders-style';
    style.textContent = [
      'body.cms-owner-live-orders .col{min-width:0;min-height:100vh}',
      /* เดิมล็อกไว้ 100vh + overflow:hidden → ทั้งหน้าเลื่อนไม่ได้เลย และล้อเมาส์ที่อยู่เหนือกรอบ
       * จะถูกส่งเข้าไปในกรอบ (คนละโดเมน) หน้าข้างนอกจึงไม่ขยับ = "เลื่อนไม่ได้"
       * ตอนนี้ปล่อยให้ "ทั้งหน้า" ยาวได้ตามเนื้อหา → แถบเลื่อนของหน้าต่างทำงานตามปกติ */
      'body.cms-owner-live-orders main#view{width:100%;max-width:none;min-height:0;margin:0;padding:10px 12px 12px;display:flex;flex-direction:column}',
      'body.cms-owner-live-orders .cms-live-orders-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      /* 164px = ระยะเหนือกรอบ (แถบบน + หัวเรื่อง + ขอบล่าง) วัดจากหน้าจริง · พอดีจอเมื่อจอสูงพอ
       * min-height 820 = เผื่อให้เมนูของพอร์ทัลข้างในแสดงครบ จอเตี้ยก็เลื่อนทั้งหน้าลงไปดูได้ */
      'body.cms-owner-live-orders .cms-live-orders-frame{display:flex;flex:1;flex-direction:column;min-width:0;height:calc(100vh - 164px);min-height:820px;background:#f4f7f4;border:1px solid #dce7df;border-radius:14px;overflow:hidden}',
      'body.cms-owner-live-orders .oc-main{max-width:none;width:100%;min-width:0;min-height:calc(100dvh - 64px);display:flex;flex-direction:column;padding:12px}',
      'body.cms-owner-live-orders .cms-owner-app-frame{min-height:calc(100dvh - 104px)}',
      'body.cms-owner-live-orders .cms-owner-app-frame .cms-live-orders-stage{min-height:65dvh}',
      'body.cms-owner-live-orders .cms-owner-app-frame .cms-live-orders-iframe{min-height:65dvh}',
      'body.cms-owner-live-orders .cms-owner-app-frame .cms-live-orders-toolbar button{white-space:nowrap}',
      'body.cms-owner-live-orders .cms-live-orders-toolbar{display:flex;flex:0 0 auto;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 13px;background:#fff;border-bottom:1px solid #dce7df;color:#31513c;font-size:12px}',
      'body.cms-owner-live-orders .cms-live-orders-toolbar strong{font:600 13px var(--display)}',
      'body.cms-owner-live-orders .cms-live-orders-toolbar button{border:1px solid #cfe0d3;background:#eff7f1;color:#17643e;border-radius:9px;padding:6px 11px;font:500 11px var(--font)}',
      'body.cms-owner-live-orders .cms-live-orders-stage{position:relative;display:flex;flex:1;min-width:0;min-height:0;background:#f4f7f4}',
      'body.cms-owner-live-orders .cms-live-orders-iframe{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:560px;border:0;background:#f4f7f4}',
      'body.cms-owner-live-orders .cms-live-orders-loading{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:24px;background:#f4f7f4;color:#236344;font:500 14px var(--font);text-align:center}',
      'body.cms-owner-live-orders .cms-live-orders-error{max-width:560px;margin:auto;padding:20px;background:#fff;border:1px solid #efd8d4;border-radius:12px;color:#9a342b;text-align:center;line-height:1.7}',
      'body.cms-owner-live-orders .cms-live-orders-error button{margin-top:12px;border:0;border-radius:9px;padding:8px 15px;background:#176b43;color:#fff}',
      '@media(max-width:959px){body.cms-owner-live-orders main#view{padding:8px 8px 10px}body.cms-owner-live-orders .cms-live-orders-frame{height:calc(100dvh - 150px);min-height:720px}}',
      '@media(max-width:520px){body.cms-owner-live-orders .cms-live-orders-toolbar{padding:7px 9px}body.cms-owner-live-orders .cms-live-orders-toolbar strong{font-size:11px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ownerPortalView(page) {
    document.body.classList.add('cms-owner-live-orders');
    installOwnerOrdersStyles();
    const run = ++ownerFrameRequest;
    setTimeout(() => loadOwnerPortalFrame(page, run), 0);
    return '<section class="cms-live-orders-frame">' +
      '<div class="cms-live-orders-toolbar"><strong>' + esc(PAGES[page]) + ' · Café Amazon</strong>' +
      '<span class="cms-live-orders-acts">' +
      '<button type="button" data-a="orderEmbedOpen" data-page="' + esc(page) + '" title="เปิดในแท็บใหม่ เต็มหน้าจอ — เมนูของระบบออเดอร์จะเลื่อนได้ครบ">⤢ เปิดเต็มจอ</button>' +
      '<button type="button" data-a="orderEmbedReload" data-page="' + esc(page) + '">↻ โหลดใหม่</button></span></div>' +
      '<div class="cms-live-orders-stage" id="cms-live-orders-stage">' +
      '<div class="cms-live-orders-loading">กำลังเชื่อมต่อ ' + esc(PAGES[page]) + '…</div></div></section>';
  }

  async function loadOwnerPortalFrame(page, run) {
    const stage = document.getElementById('cms-live-orders-stage');
    if (!stage || !PAGES[page]) return;
    stage.innerHTML = '<div class="cms-live-orders-loading">กำลังยืนยันสิทธิ์ Owner และเชื่อมต่อ ' + esc(PAGES[page]) + '…</div>';
    try {
      const ticket = await API.call('orderTicket', { t: S.token, page });
      if (run !== ownerFrameRequest || !document.getElementById('cms-live-orders-stage')) return;
      const rawUrl = typeof ticket === 'string'
        ? ticket
        : (ticket && (ticket.url || ticket.href || ticket.redirect_url || ticket.redirectUrl || (ticket.data && ticket.data.url)));
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        throw new Error('ระบบหลังร้านไม่ได้ส่ง URL สำหรับ SSO กลับมา (fields: ' + Object.keys(ticket || {}).join(', ') + ')');
      }
      const ticketTarget = new URL(rawUrl, location.href);
      const allowedOrigins = new Set([
        'https://cafe-order-web-admin-portal.github.io',
        'https://cafe-amazon-web-admin-portal.github.io'
      ]);

      // CMS orderTicket can return either a final portal SSO URL or the
      // one-time Back Office exchange URL (?__order=...). In the latter case
      // the browser must navigate the iframe to Supabase so it can perform
      // the redirect; the URL is not itself the final portal origin.
      const configuredApi = new URL((S.cfg && S.cfg.apiUrl) || window.AMZ_API || '');
      const isTicketHandoff =
        ticketTarget.origin === configuredApi.origin &&
        ticketTarget.pathname === configuredApi.pathname &&
        ticketTarget.searchParams.has('__order');
      const isFinalPortal =
        allowedOrigins.has(ticketTarget.origin) &&
        ticketTarget.hash.startsWith('#sso=') &&
        ticketTarget.hash.length > 8;

      let frameUrl = '';
      if (isTicketHandoff) {
        frameUrl = ticketTarget.href;
      } else if (isFinalPortal) {
        const portalBase = new URL('/Line-Order/', ticketTarget.origin);
        const finalTarget = new URL(page === 'orders' ? 'orders.html' : '', portalBase);
        finalTarget.hash = ticketTarget.hash;
        frameUrl = finalTarget.href;
      } else {
        const reason = [
          ticketTarget.searchParams.has('__order') ? '' : 'missing-order-ticket',
          ticketTarget.hash.startsWith('#sso=') ? '' : 'missing-sso'
        ].filter(Boolean).join(', ') || 'unknown';
        throw new Error('Ticket จาก CMS ไม่ใช่ลิงก์ SSO หรือ Back Office handoff ที่ถูกต้อง (' + reason + ') · ' + ticketTarget.origin + ticketTarget.pathname);
      }
      const frame = document.createElement('iframe');
      frame.className = 'cms-live-orders-iframe';
      frame.title = PAGES[page];
      frame.allow = 'geolocation';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      const loading = document.createElement('div');
      loading.className = 'cms-live-orders-loading';
      loading.textContent = 'กำลังเปิด ' + PAGES[page] + ' และยืนยันตัวตน Owner…';
      frame.addEventListener('load', () => {
        window.setTimeout(() => loading.remove(), 1100);
      }, { once: true });
      stage.replaceChildren(frame, loading);
      frame.src = frameUrl;
    } catch (error) {
      if (run !== ownerFrameRequest) return;
      stage.innerHTML = '<div class="cms-live-orders-error"><b>ไม่สามารถเปิด ' + esc(PAGES[page]) + ' ในหน้านี้ได้</b><br>' +
        esc(error.message || error) + '<br><button type="button" data-a="orderEmbedReload" data-page="' + esc(page) + '">ลองอีกครั้ง</button></div>';
    }
  }

  async function openOrder(page, btn) {
    // Owner opens LIVE ORDERS inside this Back Office page, preserving its sidebar.
    if ((page === 'orders' || page === 'catalog') && isCmsOwner()) { location.hash = '#' + page; return; }
    const w = window.open('', '_blank');
    try { if (w) w.document.write('<p style="font:16px sans-serif;padding:24px;color:#2F7D55">กำลังเปิด ' + PAGES[page] + '…</p>'); } catch (e) { /* */ }
    try {
      const r = await busy(btn, () => API.call('orderTicket', { t: S.token, page }), 'กำลังเปิด…');
      if (w && !w.closed) w.location.href = r.url; else location.href = r.url;
    } catch (e) { if (w) w.close(); toast(e.message); }
  }
  window.openOrder = openOrder;
  const hasRef = () => !!S.me && (S.me.role === 'owner' || !!S.me.uid);

  // Toggle the embedded layout only while Owner is on either Order System route.
  if (typeof App === 'object' && typeof App.render === 'function' && !App.__ownerOrdersRenderWrapped) {
    const renderBase = App.render.bind(App);
    App.render = function () {
      const route = location.hash.replace(/^#/, '').split('/')[0];
      if (isCmsOwner() && (route === 'orders' || route === 'catalog')) {
        document.body.classList.add('cms-owner-live-orders');
      } else {
        document.body.classList.remove('cms-owner-live-orders');
      }
      return renderBase();
    };
    App.__ownerOrdersRenderWrapped = true;
  }

  /* ---------- เว็บหลังร้าน ---------- */
  if (typeof defMod === 'function' && typeof GROUPS !== 'undefined') {
    const card = page => `<div class="group pad"><p style="margin-top:0">${page === 'orders'
      ? 'รับออเดอร์จาก LINE / เว็บ ยืนยัน เตรียม ส่ง พร้อมแผนที่ลูกค้า แบบ LIVE'
      : 'จัดการสินค้า หมวดหมู่ ตัวเลือก ราคาและการเปิดขายรายสาขา นำเข้าไฟล์'}</p>
      <p class="muted">ใช้บัญชีเดียวกับหลังร้าน กดแล้วเข้าระบบให้อัตโนมัติ (แท็บใหม่)</p>
      ${hasRef() ? `<button class="btn primary big" data-a="orderOpen:${page}">เปิด ${PAGES[page]}</button>` : '<p class="note bad">ต้องมีบัญชีผู้ใช้ (Users) ที่เปิดใช้งานแล้ว ติดต่อ Owner/Admin</p>'}</div>`;
    defMod({ key: 'orders', mod: 'stock', label: 'Live Orders', icon: 'orders', desc: 'ระบบออเดอร์ · รับและจัดการออเดอร์', perm: ['orders'], noBranch: true, view: () => isCmsOwner() ? ownerPortalView('orders') : card('orders'), summary: () => 'รับออเดอร์ LINE / เว็บ แบบ LIVE' });
    defMod({ key: 'catalog', mod: 'stock', label: 'Web Admin Portal', icon: 'catalog', desc: 'ระบบออเดอร์ · สินค้า ราคา เปิดขาย', perm: ['catalog'], noBranch: true, view: () => isCmsOwner() ? ownerPortalView('catalog') : card('catalog'), summary: () => 'สินค้า หมวดหมู่ ราคา เปิดขายรายสาขา' });
    const at = GROUPS.findIndex(g => g[0] === 'Operations');
    GROUPS.splice(at + 1, 0, ['Order System', ['orders', 'catalog']]);
    NAV_ORDER.splice(0, NAV_ORDER.length, ...GROUPS.flatMap(g => g[1]));
    Object.assign(ACT, {
      orderOpen: (a, b) => openOrder(a, b),
      orderEmbedOpen: async (a, b) => {
        const page = b?.dataset?.page || 'orders';
        const win = window.open('', '_blank');                   // เปิดแท็บก่อนรอเซิร์ฟเวอร์ ไม่งั้นเบราว์เซอร์บล็อก
        try {
          const ticket = await API.call('orderTicket', { t: S.token, page });   // ตั๋วใช้ได้ครั้งเดียว ต้องขอใหม่ทุกครั้ง
          const url = typeof ticket === 'string' ? ticket : (ticket && (ticket.url || ticket.href || ticket.redirect_url || ticket.redirectUrl || (ticket.data && ticket.data.url)));
          if (!url) throw new Error('ระบบไม่ได้ส่งลิงก์กลับมา');
          if (win) win.location = new URL(url, location.href).href; else location.href = url;
        } catch (e) {
          if (win) win.close();
          toast('เปิดเต็มจอไม่สำเร็จ: ' + (e.message || e));
        }
      },
      orderEmbedReload: (a, b) => { const page = b?.dataset?.page || document.querySelector('[data-a="orderEmbedReload"]')?.dataset.page || 'orders'; return loadOwnerPortalFrame(page, ++ownerFrameRequest); }
    });
    // กดเมนูแล้วเปิดระบบออเดอร์เลย (หน้าในหลังร้านเป็นทางสำรอง)
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href="#orders"],a[href="#catalog"]');
      if (!a || !hasRef() || e.metaKey || e.ctrlKey) return;
      const page = a.getAttribute('href').slice(1);
      // Owner lets the Back Office router render the embedded orders view in-place.
      if ((page === 'orders' || page === 'catalog') && isCmsOwner()) return;
      e.preventDefault(); openOrder(page, null);
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

  /* ---------- แอป Owner (PWA: PC / Mobile) ---------- */
  if (typeof ocLanding === 'function' && typeof OC === 'object') {
    const l0 = ocLanding;
    const addOwnerOrderButtons = () => {
      const menu = document.querySelector('.oc-land-menu');
      if (!menu || menu.querySelector('[data-owner-order]')) return;
      menu.insertAdjacentHTML('beforeend',
        '<button class="oc-big" type="button" data-owner-order="orders"><span class="ic">' + icon('orders') + '</span><b>Live Orders</b><small>รับและจัดการออเดอร์แบบ Real-time</small></button>' +
        '<button class="oc-big" type="button" data-owner-order="catalog"><span class="ic">' + icon('catalog') + '</span><b>Web Admin Portal</b><small>จัดการสินค้า หมวดหมู่ ตัวเลือก และราคา</small></button>'
      );
    };
    window.ocLanding = ocLanding = function () {
      document.body.classList.remove('cms-owner-live-orders');
      l0.apply(this, arguments);
      addOwnerOrderButtons();
    };
    addOwnerOrderButtons();

    const ocGoBase = ocGo;
    window.ocGo = ocGo = async function (view) {
      if (view !== 'orders' && view !== 'catalog') {
        document.body.classList.remove('cms-owner-live-orders');
        return ocGoBase(view);
      }
      if (!OC.me) { OC.after = view; return ocLogin(); }
      if (OC.me.role !== 'owner') return ocLanding('เมนูนี้ใช้ได้เฉพาะบัญชี Owner');
      document.body.classList.add('cms-owner-live-orders');
      installOwnerOrdersStyles();
      OC.view = view;
      clearInterval(OC.timer);
      if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
      ocShell('<p class="loading">กำลังเปิด ' + esc(PAGES[view]) + '…</p>');
      const main = document.querySelector('.oc-main');
      if (main) {
        main.style.maxWidth = 'none';
        main.style.minWidth = '0';
        main.style.padding = '12px';
        main.style.display = 'flex';
        main.style.flexDirection = 'column';
        main.style.minHeight = 'calc(100dvh - 64px)';
      }
      ocMain(
        '<section class="cms-live-orders-frame cms-owner-app-frame">' +
        '<div class="cms-live-orders-toolbar"><strong>' + esc(PAGES[view]) + ' · Café Amazon</strong>' +
        '<button type="button" data-owner-order-back>← กลับหน้า Owner</button>' +
        '<span class="cms-live-orders-acts">' +
        '<button type="button" data-owner-order-open data-page="' + esc(view) + '" title="เปิดในแท็บใหม่ เต็มหน้าจอ">⤢ เปิดเต็มจอ</button>' +
        '<button type="button" data-owner-order-reload data-page="' + esc(view) + '">↻ โหลดใหม่</button></span></div>' +
        '<div class="cms-live-orders-stage" id="cms-live-orders-stage">' +
        '<div class="cms-live-orders-loading">กำลังยืนยันสิทธิ์ Owner…</div></div></section>'
      );
      const run = ++ownerFrameRequest;
      setTimeout(() => loadOwnerPortalFrame(view, run), 0);
    };

    document.addEventListener('click', async e => {
      const openButton = e.target.closest('[data-owner-order-open]');
      if (openButton) {
        e.preventDefault();
        const page = openButton.dataset.page || OC.view || 'orders';
        const win = window.open('', '_blank');                   // เปิดแท็บก่อนรอเซิร์ฟเวอร์ ไม่งั้นเบราว์เซอร์บล็อก
        try {
          const ticket = await API.call('orderTicket', { t: S.token, page });   // ตั๋วใช้ได้ครั้งเดียว ต้องขอใหม่ทุกครั้ง
          const url = typeof ticket === 'string' ? ticket : (ticket && (ticket.url || ticket.href || ticket.redirect_url || ticket.redirectUrl || (ticket.data && ticket.data.url)));
          if (!url) throw new Error('ระบบไม่ได้ส่งลิงก์กลับมา');
          if (win) win.location = new URL(url, location.href).href; else location.href = url;
        } catch (err) { if (win) win.close(); toast('เปิดเต็มจอไม่สำเร็จ: ' + (err.message || err)); }
        return;
      }
      const reloadButton = e.target.closest('[data-owner-order-reload]');
      if (reloadButton) {
        e.preventDefault();
        const page = reloadButton.dataset.page || OC.view || 'orders';
        return loadOwnerPortalFrame(page, ++ownerFrameRequest);
      }
      const orderButton = e.target.closest('[data-owner-order]');
      if (orderButton) {
        e.preventDefault();
        const page = orderButton.dataset.ownerOrder;
        if (!OC.me) { OC.after = page; return ocLogin(); }
        return ocGo(page);
      }
      if (e.target.closest('[data-owner-order-back]')) {
        e.preventDefault();
        return ocLanding();
      }
    });
  }
})();
