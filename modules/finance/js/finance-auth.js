/* Finance API adapter.
 * The CMS host must inject its verified custom-session token provider.
 * No guessed browser storage keys and no request is sent until Finance is opened.
 */
(function(global){
  'use strict';
  const ENDPOINT='https://ytxbnqosenolojifeikf.supabase.co/functions/v1/finance-api';
  let getSessionToken=null, cached=null, cachedAt=0;
  const CACHE_MS=60*1000;
  function configure(options){
    if(!options||typeof options.getSessionToken!=='function')throw new TypeError('FinanceAuth requires a getSessionToken function');
    getSessionToken=options.getSessionToken;clear();
  }
  async function token(){
    if(!getSessionToken)throw new Error('Finance ยังไม่ได้เชื่อม CMS Session');
    const value=await getSessionToken();
    if(typeof value!=='string'||!value||value.length>4096)throw new Error('ไม่พบ CMS Session กรุณาเข้าสู่ระบบใหม่');
    return value;
  }
  async function request(action,options={}){
    const session=await token(), method=options.method||'GET';
    const url=new URL(ENDPOINT);
    if(method==='GET')url.searchParams.set('action',action);
    const headers={'x-cms-session':session,'accept':'application/json'};
    if(method!=='GET')headers['content-type']='application/json';
    if(options.idempotencyKey)headers['idempotency-key']=options.idempotencyKey;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{method,headers,body:method==='GET'?undefined:JSON.stringify({...options.body,action}),cache:'no-store',signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body.ok)throw new Error(body.error||'Finance API request failed');
      return body.data;
    }finally{clearTimeout(timer);}
  }
  async function verify(force=false){
    if(!force&&cached&&Date.now()-cachedAt<CACHE_MS)return cached;
    cached=await request('session');cachedAt=Date.now();return cached;
  }
  function clear(){cached=null;cachedAt=0;}
  global.FinanceAuth=Object.freeze({configure,request,verify,clear});
})(window);
