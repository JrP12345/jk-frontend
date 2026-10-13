import type { User } from '@/store/authStore';
import { hasAnyPermission } from './permissions';

/** Payment pending or an arrived patient is not evidence of nonattendance. */
export function canRecordNoShow(user: Pick<User, 'role' | 'permissions'> | null, visit: { status: string; appointmentTime: string }, now = Date.now()) {
  const scheduled = Date.parse(visit.appointmentTime);
  return hasAnyPermission(user, 'MANAGE_APPOINTMENTS') &&
    ['pending', 'confirmed'].includes(visit.status) &&
    Number.isFinite(scheduled) && scheduled <= now;
}
