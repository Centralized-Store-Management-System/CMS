/* Finance Auth Adapter.
 * CMS host must explicitly inject the current custom-session token provider after verifying its session.
 * Never reads guessed localStorage/sessionStorage keys and never starts network traffic on page load.
 */
(function(global){
  'use strict';
  const ENDPOINT='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance';
  let getSessionToken=null;
  let cached=null, cachedAt=0;
  const CACHE_MS=60*1000;
  function configure(options){
    if(!options||typeof options.getSessionToken!=='function')throw new TypeError('FinanceAuth requires a getSessionToken function');
    getSessionToken=options.getSessionToken;
    cached=null;cachedAt=0;
  }
  async function verify(force){
    if(!getSessionToken)throw new Error('Finance ยังไม่ได้เชื่อม CMS Session');
    if(!force&&cached&&Date.now()-cachedAt<CACHE_MS)return cached;
    const token=await getSessionToken();
    if(typeof token!=='string'||!token||token.length>4096)throw new Error('ไม่พบ CMS Session กรุณาเข้าสู่ระบบใหม่');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(ENDPOINT,{method:'GET',headers:{'x-cms-session':token,'accept':'application/json'},cache:'no-store',signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body.ok)throw new Error(body.error||'ไม่สามารถยืนยันสิทธิ์ Finance ได้');
      cached=body.data;cachedAt=Date.now();return cached;
    }finally{clearTimeout(timer);}
  }
  function clear(){cached=null;cachedAt=0;}
  global.FinanceAuth=Object.freeze({configure,verify,clear});
})(window);
