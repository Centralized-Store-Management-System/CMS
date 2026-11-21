/* Verified CMS session bridge for the standalone Finance page.
 * CMS app.js stores its active custom session in sessionStorage under "amz.tok".
 * Finance never reads CMS storage directly elsewhere; the token is sent only in
 * the x-cms-session header to the isolated Finance API, which revalidates it.
 */
(function(global){
  'use strict';
  function getSessionToken(){
    try { return global.sessionStorage.getItem('amz.tok') || ''; }
    catch (_) { return ''; }
  }
  if (!global.FinanceAuth || typeof global.FinanceAuth.configure !== 'function') {
    console.error('FinanceAuth is unavailable; CMS session bridge was not configured.');
    return;
  }
  global.FinanceAuth.configure({ getSessionToken });
  global.FinanceCmsSession = Object.freeze({
    available: function(){ return !!getSessionToken(); },
    clear: function(){ global.FinanceAuth.clear(); }
  });
})(window);
