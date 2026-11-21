/* Pure Finance calculation rules shared by browser previews and tests. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FinanceCalculations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const round2=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
  function calculate(lines,vatRate=7,whtRate=0){
    if(!Array.isArray(lines)||!lines.length)throw new TypeError('At least one line item is required');
    const vat=Number(vatRate),wht=Number(whtRate);
    if(![0,7].includes(vat))throw new RangeError('Unsupported VAT rate');
    if(![0,1,2,3,5,10].includes(wht))throw new RangeError('Unsupported WHT rate');
    let subtotal=0,vatTotal=0,whtTotal=0;
    const normalized=lines.map((line,index)=>{
      const description=String(line.description||'').trim();
      const quantity=Number(line.quantity),unitPrice=Number(line.unit_price??line.unitPrice);
      if(!description||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0)throw new TypeError('Invalid line item '+(index+1));
      const amount=round2(quantity*unitPrice);
      const lineVat=round2(amount*vat/100),lineWht=round2(amount*wht/100);
      subtotal+=amount;vatTotal+=lineVat;whtTotal+=lineWht;
      return {description,quantity,unit_price:unitPrice,amount,vat_amount:lineVat,wht_amount:lineWht};
    });
    subtotal=round2(subtotal);vatTotal=round2(vatTotal);whtTotal=round2(whtTotal);
    return {lines:normalized,subtotal,vat_total:vatTotal,wht_total:whtTotal,grand_total:round2(subtotal+vatTotal-whtTotal)};
  }
  return Object.freeze({round2,calculate});
});
