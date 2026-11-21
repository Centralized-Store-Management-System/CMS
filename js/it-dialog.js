/* IT Dialog UX · accessible responsive confirmation / alert / prompt */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function show({title='ยืนยันรายการ',message='',detail='',kind='confirm',value='',placeholder='',confirmText='ยืนยัน',cancelText='ยกเลิก',danger=false}={}){
  return new Promise(resolve=>{
   document.querySelector('.it-dialog-backdrop')?.remove();
   const wrap=document.createElement('div');wrap.className='it-dialog-backdrop';wrap.innerHTML=`
    <section class="it-dialog" role="dialog" aria-modal="true" aria-labelledby="it-dialog-title">
     <div class="it-dialog-mark ${danger?'danger':''}">${danger?'!':kind==='alert'?'i':'✓'}</div>
     <h2 id="it-dialog-title">${esc(title)}</h2>
     <p class="it-dialog-message">${esc(message)}</p>
     ${detail?`<p class="it-dialog-detail">${esc(detail)}</p>`:''}
     ${kind==='prompt'?'<input class="it-dialog-input" type="text" autocomplete="off">':''}
     <div class="it-dialog-actions">
      ${kind==='alert'?'':`<button type="button" class="it-dialog-cancel">${esc(cancelText)}</button>`}
      <button type="button" class="it-dialog-ok ${danger?'is-danger':''}">${esc(confirmText)}</button>
     </div>
    </section>`;
   document.body.appendChild(wrap);
   const input=wrap.querySelector('input');if(input){input.value=value;input.placeholder=placeholder;}
   let done=false;const finish=v=>{if(done)return;done=true;wrap.classList.add('is-closing');setTimeout(()=>wrap.remove(),130);resolve(v);};
   wrap.querySelector('.it-dialog-ok').addEventListener('click',()=>finish(kind==='prompt'?(input.value):true));
   wrap.querySelector('.it-dialog-cancel')?.addEventListener('click',()=>finish(kind==='prompt'?null:false));
   wrap.addEventListener('click',e=>{if(e.target===wrap)finish(kind==='prompt'?null:false);});
   const key=e=>{if(e.key==='Escape'){finish(kind==='prompt'?null:false);document.removeEventListener('keydown',key);}if(e.key==='Enter'&&kind==='prompt'){finish(input.value);document.removeEventListener('keydown',key);}};
   document.addEventListener('keydown',key);
   (input||wrap.querySelector('.it-dialog-ok')).focus();
  });
 }
 window.ITDialog={
  confirm:(message,opts={})=>show({message,...opts,kind:'confirm'}),
  alert:(message,opts={})=>show({message,...opts,kind:'alert',confirmText:opts.confirmText||'เข้าใจแล้ว'}),
  prompt:(message,value='',opts={})=>show({message,value,...opts,kind:'prompt',confirmText:opts.confirmText||'บันทึก'})
 };
})();