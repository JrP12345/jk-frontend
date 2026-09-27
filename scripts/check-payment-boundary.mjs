import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(import.meta.dirname, '../src/app/(dashboard)/dashboard/bills/page.tsx'), 'utf8');
assert(!source.includes('cardNumber') && !source.includes('cvc'), 'Checkout must not collect raw card details.');
assert(source.includes('paymentToken'), 'Checkout must retain the payment-token boundary.');
console.log('PASS: checkout retains its payment-token boundary without raw card fields.');
