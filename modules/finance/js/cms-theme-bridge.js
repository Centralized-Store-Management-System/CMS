/* Finance Theme Bridge — consumes the CMS theme contract without loading CMS runtime.
 * Reads only the existing, same-origin theme preferences; no API, polling, or network requests.
 */
(function(){
  'use strict';
  const root=document.documentElement;
  const defaults={primary:'#1E4D38',accent:'#2F7D55',bg:'#F1F4F1',font:'IBM Plex Sans Thai',head:'Prompt',mode:'auto',ui:'classic',scale:'m',radius:'round',density:'normal'};
  const valid=c=>/^#[0-9a-f]{6}$/i.test(String(c||''));
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function apply(){
    const theme={...defaults,...read('amz.theme')};
    const personal=read('amz.mytheme');
    const primary=valid(theme.primary)?theme.primary:defaults.primary;
    const accent=valid(theme.accent)?theme.accent:primary;
    const bg=valid(theme.bg)?theme.bg:defaults.bg;
    const font=String(theme.font||defaults.font).replace(/["\\]/g,'');
    const head=String(theme.head||defaults.head).replace(/["\\]/g,'');
    root.style.setProperty('--green',primary);
    root.style.setProperty('--brand',primary);
    root.style.setProperty('--focus',accent);
    root.style.setProperty('--bg',bg);
    root.style.setProperty('--sunk', 'color-mix(in srgb,'+bg+' 93%,'+primary+')');
    root.style.setProperty('--line', 'color-mix(in srgb,'+primary+' 15%,'+bg+')');
    root.style.setProperty('--font','"'+font+'","IBM Plex Sans Thai","Leelawadee UI","Noto Sans Thai",sans-serif');
    root.style.setProperty('--display','"'+head+'","IBM Plex Sans Thai","Leelawadee UI",sans-serif');
    root.style.setProperty('--brand',primary);
    root.style.setProperty('--bg',bg);
    root.style.setProperty('--line', 'color-mix(in srgb,'+primary+' 15%,'+bg+')');
    root.style.setProperty('--dark',primary);
    root.style.setProperty('--fm-accent',accent);
    root.style.setProperty('--fm-bg',bg);
    root.style.setProperty('--fm-font','"'+font+'","IBM Plex Sans Thai","Leelawadee UI","Noto Sans Thai",sans-serif');
    root.style.setProperty('--fm-display','"'+head+'","IBM Plex Sans Thai","Leelawadee UI",sans-serif');
    const mode=personal.mode||theme.mode||'auto';
    if(mode==='dark'||mode==='light')root.dataset.theme=mode;else delete root.dataset.theme;
    if((personal.ui||theme.ui)==='b')root.dataset.ui='b';else delete root.dataset.ui;
    root.style.setProperty('--fm-scale',({s:.93,m:1,l:1.08,xl:1.16}[personal.scale||theme.scale]||1));
    root.style.setProperty('--fm-radius',(theme.radius||'round')==='square'?'5px':'11px');
    root.style.setProperty('--fm-density',(theme.density||'normal')==='compact'?'0.85':'1');
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=primary;
    const logo=document.querySelector('.fm-brand-mark');
    if(logo&&typeof theme.logo==='string'&&/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(theme.logo)){
      logo.innerHTML='<img alt="" src="'+theme.logo.replace(/"/g,'%22')+'">';
      logo.classList.add('has-logo');
    }
    const title=document.querySelector('[data-cms-theme-title]');
    if(title&&theme.title)title.textContent=theme.title;
  }
  apply();
  window.addEventListener('storage',e=>{if(!e.key||e.key==='amz.theme'||e.key==='amz.mytheme')apply();});
  window.addEventListener('pageshow',apply);
})();