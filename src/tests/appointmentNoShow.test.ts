import { describe, expect, it } from 'vitest';
import { canRecordNoShow } from '@/lib/appointmentNoShow';

const now = Date.parse('2026-10-12T12:00:00Z');
const staff = { role: 'receptionist', permissions: ['MANAGE_APPOINTMENTS'] };
const visit = { status: 'confirmed', appointmentTime: '2026-10-12T11:00:00Z' };
describe('Explicit nonattendance authority', () => {
  it('allows an authorized desk to review past unarrived visits', () => {
    expect(canRecordNoShow(staff, visit, now)).toBe(true);
    expect(canRecordNoShow(staff, { ...visit, status: 'pending' }, now)).toBe(true);
  });
  it.each(['pending_payment', 'checked-in', 'standby', 'in-consultation', 'completed', 'cancelled', 'no-show'])('does not equate %s with nonattendance', status => {
    expect(canRecordNoShow(staff, { ...visit, status }, now)).toBe(false);
  });
  it('requires appointment authority even for an administrator or the booking patient', () => {
    expect(canRecordNoShow({ role: 'admin', permissions: ['VIEW_APPOINTMENTS'] }, visit, now)).toBe(false);
    expect(canRecordNoShow({ role: 'patient', permissions: [] }, visit, now)).toBe(false);
    expect(canRecordNoShow(null, visit, now)).toBe(false);
  });
  it('rejects a future or unparseable scheduled instant', () => {
    expect(canRecordNoShow(staff, { ...visit, appointmentTime: '2026-10-12T12:01:00Z' }, now)).toBe(false);
    expect(canRecordNoShow(staff, { ...visit, appointmentTime: 'unknown' }, now)).toBe(false);
  });
});
