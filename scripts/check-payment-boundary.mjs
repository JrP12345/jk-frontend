import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(import.meta.dirname, '../src/app/(dashboard)/dashboard/bills/page.tsx'), 'utf8');
assert(!source.includes('cardNumber') && !source.includes('cvc'), 'Checkout must not collect raw card details.');
assert(!source.includes('paymentToken') && !/api\.put\([^\n]*\/pay/.test(source), 'Patient checkout must not use placeholder tokens or staff invoice collection.');
assert(source.includes('loadRazorpayScript') && source.includes('/appointment-payments/create-order') && source.includes('/appointment-payments/verify'), 'Checkout must use hosted payment and server verification.');
assert(source.includes('razorpaySignature') && source.includes('razorpayOrderId') && source.includes('razorpayPaymentId'), 'Gateway proof must be sent for verification.');
console.log('PASS: patient checkout uses hosted payment and server verification without raw card fields or manual collection.');
