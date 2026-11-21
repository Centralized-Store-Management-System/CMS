const test = require('node:test');
const assert = require('node:assert/strict');
const FinanceCalculations = require('../../modules/finance/js/finance-calculations.js');

test('calculates VAT 7% on one line', () => {
  const result = FinanceCalculations.calculate([{description:'Coffee beans',quantity:1,unit_price:100}],7,0);
  assert.equal(result.subtotal,100);
  assert.equal(result.vat_total,7);
  assert.equal(result.wht_total,0);
  assert.equal(result.grand_total,107);
});

test('calculates WHT on pre-VAT base', () => {
  const result = FinanceCalculations.calculate([{description:'Service',quantity:1,unit_price:1000}],7,3);
  assert.equal(result.vat_total,70);
  assert.equal(result.wht_total,30);
  assert.equal(result.grand_total,1040);
});

test('rounds tax per line before summing', () => {
  const result = FinanceCalculations.calculate([
    {description:'A',quantity:1,unit_price:0.08},
    {description:'B',quantity:1,unit_price:0.05},
    {description:'C',quantity:1,unit_price:0.05},
  ],7,3);
  assert.equal(result.subtotal,0.24);
  assert.equal(result.vat_total,0.03);
  assert.equal(result.wht_total,0);
  assert.equal(result.grand_total,0.27);
});

test('supports zero-rated VAT and no withholding', () => {
  const result = FinanceCalculations.calculate([{description:'Goods',quantity:2,unit_price:50}],0,0);
  assert.equal(result.grand_total,100);
});

test('rejects empty documents', () => {
  assert.throws(() => FinanceCalculations.calculate([],7,0), /At least one line/);
});

test('rejects unsupported tax rates', () => {
  assert.throws(() => FinanceCalculations.calculate([{description:'A',quantity:1,unit_price:1}],5,0), /VAT rate/);
  assert.throws(() => FinanceCalculations.calculate([{description:'A',quantity:1,unit_price:1}],7,4), /WHT rate/);
});

test('rejects non-positive quantity and negative price', () => {
  assert.throws(() => FinanceCalculations.calculate([{description:'A',quantity:0,unit_price:1}],7,0), /Invalid line/);
  assert.throws(() => FinanceCalculations.calculate([{description:'A',quantity:1,unit_price:-1}],7,0), /Invalid line/);
});
