// Rich fictional dataset for local presentation captures only. No database or live API.
import { fixture as baseFixture, ids, users as baseUsers, plan as basePlan } from './fixtures.mjs';

export { ids };
export const demoDay = '2026-10-24';
export const demoClock = demoDay + 'T04:30:00.000Z';
const at = time => `${demoDay}T${time}:00+05:30`;
const key = n => n.toString(16).padStart(24, '0');
const data = value => ({ success: true, data: value });
const list = value => ({ ...data(value), pagination: { page: 1, limit: 20, total: value.length, totalPages: 1, hasMore: false }, total: value.length, totalPages: 1, page: 1 });
export const users = Object.fromEntries(Object.entries(baseUsers).map(([role, user]) => [role, { ...user, id: role === 'admin' ? key(101) : user.id, name: role === 'doctor' ? 'Mira Shah' : role === 'admin' ? 'Aditi Rao' : 'Anaya Sen', email: `${role}@example.test` }]));
const hours = JSON.stringify(Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => [day, [{ start: '09:00', end: '13:00' }, { start: '16:00', end: '18:00' }]])));
export const doctors = [
  { id: ids.doctor, name: 'Mira Shah', specialization: 'General Medicine', qualification: 'MBBS, MD', fees: 600, slug: 'mira-shah', experience_years: 12 },
  { id: key(302), name: 'Arjun Mehta', specialization: 'Pediatrics', qualification: 'MBBS, DCH', fees: 700, slug: 'arjun-mehta', experience_years: 9 },
  { id: key(303), name: 'Leena Iyer', specialization: 'Dermatology', qualification: 'MBBS, MD', fees: 800, slug: 'leena-iyer', experience_years: 11 },
].map(item => ({ ...baseUsers.doctor, ...item, _id: item.id, email: `${item.slug}@example.test`, role: 'doctor', feeType: 'fixed', experienceYears: item.experience_years, bookingMode: 'time_slot', isAvailable: true, languages: ['English', 'Hindi'], imageUrl: null }));
export const locations = [
  { id: ids.location, name: 'Aster Grove Clinic', slug: 'aster-grove', address: 'Demonstration address · Baner', city: 'Pune', doctors },
  { id: key(202), name: 'Aster Grove East', slug: 'aster-grove-east', address: 'Demonstration address · Kalyani Nagar', city: 'Pune', doctors: [doctors[0], doctors[2]] },
].map(item => ({ ...item, _id: item.id, organizationId: ids.org, organization_id: ids.org, facilityType: 'clinic', currency: 'INR', timezone: 'Asia/Kolkata', effectiveTimezone: 'Asia/Kolkata', email: 'clinic@example.test', phone: '', description: 'Illustrative multi-specialty practice. All people, records and activity are synthetic.', isPublished: true, onlineBookingAvailable: true, doctorCount: item.doctors.length, minFee: 600, specialties: item.doctors.map(doctor => doctor.specialization), doctorsSummary: item.doctors, organizationLocationCount: 2, timings: 'Mon–Sat · 09:00–13:00, 16:00–18:00', image_url: '', logo_url: '' }));
const names = ['Anaya Sen', 'Kabir Nair', 'Tara Menon', 'Rohan Desai', 'Ira Kapoor', 'Nikhil Shah', 'Sana Joshi', 'Dev Malhotra'];
export const patients = names.map((name, index) => {
  const id = index ? key(401 + index) : ids.patient;
  const dob = index ? '1990-06-15' : '1991-02-12';
  const phone = `00000000${String(index + 41).padStart(2, '0')}`;
  return { id, _id: id, name, firstName: name.split(' ')[0], lastName: name.split(' ')[1], userId: { id, name, phone, email: `patient-${index + 1}@example.test`, dob, gender: index % 2 ? 'male' : 'female' }, phone, email: `patient-${index + 1}@example.test`, dob, dateOfBirth: dob, age: index ? 36 : 35, gender: index % 2 ? 'male' : 'female', mrn: `DEMO-${String(index + 1).padStart(3, '0')}`, patientId: `DEMO-${String(index + 1).padStart(3, '0')}`, bloodGroup: 'O+', allergies: [], conditions: [], medicalHistory: [], address: 'Illustrative address', city: 'Pune', createdAt: at('08:00') };
});
const visitTimes = ['10:30', '10:15', '10:45', '11:00', '11:15', '09:15', '09:30', '11:30'];
const statuses = ['checked-in', 'in-consultation', 'confirmed', 'checked-in', 'pending', 'completed', 'completed', 'cancelled'];
export const appointments = patients.map((patient, index) => {
  const doctor = index === 3 ? doctors[1] : index === 4 ? doctors[2] : doctors[0];
  const id = index ? key(501 + index) : ids.visit;
  return { id, _id: id, patientId: patient, patient, doctorId: doctor, doctor, locationId: locations[0], location: locations[0], appointmentDate: at(visitTimes[index]), appointmentTime: at(visitTimes[index]), date: demoDay, time: visitTimes[index], timeSlot: visitTimes[index], status: statuses[index], tokenNumber: index + 13, queueNumber: index + 13, patientName: patient.name, doctorName: doctor.name, appointmentType: index === 3 ? 'walk-in' : 'scheduled', type: 'consultation', consultationType: 'in-person', consultationFee: doctor.fees, fees: doctor.fees, isTeleconsultation: false, checkInTime: ['checked-in', 'in-consultation', 'completed'].includes(statuses[index]) ? at('09:55') : null, createdAt: at('08:15') };
});
for (const [index, appointment] of appointments.entries()) {
  appointment.paymentAmount = appointment.fees;
  appointment.paymentStatus = index === 5 || index === 6 ? 'paid' : 'unpaid';
}
export const invoices = [0, 5, 6, 2, 3].map((patientIndex, index) => {
  const visit = appointments[patientIndex], paid = index < 3 ? visit.fees : index === 3 ? 300 : 0;
  return { id: index ? key(601 + index) : ids.invoice, _id: index ? key(601 + index) : ids.invoice, invoiceNumber: `DEMO-102${index + 1}`, patientId: visit.patientId, patient: visit.patientId, locationId: locations[0], doctorId: visit.doctorId, appointmentId: visit, currency: 'INR', items: [{ description: 'Clinic consultation', name: 'Clinic consultation', quantity: 1, unitPrice: visit.fees, amount: visit.fees, total: visit.fees }], subtotal: visit.fees, tax: 0, discount: 0, total: visit.fees, totalAmount: visit.fees, amountPaid: paid, balanceDue: visit.fees - paid, status: paid === visit.fees ? 'paid' : paid ? 'partially_paid' : 'unpaid', createdAt: at('09:40'), invoiceDate: at('09:40') };
});
const plans = [
  { ...basePlan, name: 'Essential demo', slug: 'essential-demo', description: 'Illustrative plan for a small practice', monthlyPrice: 900, annualPrice: 9000 },
  { ...basePlan, id: key(702), name: 'Practice demo', slug: 'practice-demo', description: 'Illustrative plan for a growing team', monthlyPrice: 1900, annualPrice: 19000, isPopular: true, limits: { ...basePlan.limits, maxDoctors: 8, maxStaff: 15, maxLocations: 2 } },
  { ...basePlan, id: key(703), name: 'Network demo', slug: 'network-demo', description: 'Illustrative plan for multiple locations', monthlyPrice: 3900, annualPrice: 39000, limits: { ...basePlan.limits, maxDoctors: 20, maxStaff: 40, maxLocations: 5 }, features: { ...basePlan.features, multiBranch: true } },
];
const collections = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
const organization = { id: ids.org, _id: ids.org, name: 'Aster Grove Practice', city: 'Pune', slug: 'aster-grove', status: 'active', isActive: true, currency: 'INR', timezone: 'Asia/Kolkata', country: 'IN', plan: 'practice', workflowPreferences: { registration: 'full', consultation: 'full' }, subscription: { status: 'active', planId: plans[1] }, createdAt: at('08:00') };
const notifications = [
  ['patient', 'Anaya Sen checked in', 'Token 13 · Dr. Mira Shah · Aster Grove Clinic', 'info', '/dashboard/queue'],
  ['billing', 'Payment recorded for Anaya Sen', 'DEMO-1021 · ₹600 · Consultation invoice settled', 'success', '/dashboard/billing'],
  ['patient', 'Tara Menon booked an appointment', '10:45 AM · General Medicine · Confirmation recorded', 'info', '/dashboard/appointments'],
  ['team', 'Dr. Leena Iyer’s clinic session is scheduled', 'Dermatology · Aster Grove Clinic · 09:00 AM–01:00 PM', 'info', '/dashboard/staff'],
  ['system', 'Clinic activity summary is available', 'Review today’s appointments, collections and location activity.', 'info', '/dashboard'],
].map(([category, title, message, severity, actionUrl], index) => ({ id: key(801 + index), targetUser: users.admin.id, category, type: 'system', title, message, severity, priority: 'medium', readAt: index > 2 ? at('09:30') : null, createdAt: at(`09:${String(59 - index * 5).padStart(2, '0')}`), actionUrl }));
const note = { id: key(901), revision: 1, status: 'draft', subjective: { chiefComplaint: 'Review of intermittent headache', historyOfPresentIllness: 'Illustrative follow-up history for this demonstration visit. No real clinical record.', symptoms: [] }, objective: { physicalExamination: 'Demonstration examination summary', observationIds: [{ code: 'BP', value: '118/76' }, { code: 'HR', value: '72' }, { code: 'SPO2', value: '99' }, { code: 'TEMP', value: '98.4' }] }, assessment: { diagnoses: [{ description: 'Demonstration follow-up assessment', code: 'DEMO' }], severity: 'mild' }, plan: { treatmentPlan: 'Illustrative visit plan. Not medical advice or a real prescription.', prescriptionIds: [] } };

export function fixture(url, role = 'admin', method = 'GET', scene = '') {
  const p = url.pathname.replace(/^\/api/, '');
  if (method === 'POST' && p === '/encounters') return data({ id: ids.visit, patientId: ids.patient, appointmentId: ids.visit, locationId: ids.location, status: 'in-progress', encounterType: 'opd' });
  if (method === 'POST' && p === '/auth/refresh') return data({ user: users[role] || users.admin });
  if (!['GET', 'HEAD'].includes(method)) return undefined;
  if (p === '/auth/me') return data({ user: users[role] || users.admin });
  if (p === '/auth/workspaces') return data([{ organizationId: ids.org, organizationName: organization.name, role: users[role]?.role || 'admin', workspaceProfile: 'clinic', isCurrent: true }]);
  if (p === '/organizations') return list([organization]);
  if (['/onboarding/organization', '/organization', `/organizations/${ids.org}`].includes(p)) return data(organization);
  if (['/onboarding/locations', '/crm/locations', '/public/locations'].includes(p)) return data(locations);
  if (p === '/onboarding/staff') return data({ doctors, receptionists: [{ id: key(102), name: 'Aditi Rao', email: 'reception@example.test', role: 'receptionist' }, { id: key(103), name: 'Neel Bose', email: 'frontdesk@example.test', role: 'receptionist' }], admins: [users.admin], nurses: [], staff: [users.admin] });
  if (p === '/onboarding/doctors/assignments') return data(doctors.map((doctor, index) => ({ id: key(1001 + index), doctorId: doctor, locationId: locations[0], fees: doctor.fees, feeType: 'fixed', appointmentDuration: 15, bookingMode: 'time_slot', workingHours: hours })));
  if (p === '/appointments' || p === '/appointments/patient/me') return list(appointments);
  if (p === '/patients') return list(patients);
  if (p === '/invoices') return list(invoices);
  if (p === `/appointments/${ids.visit}`) return data({ ...appointments[0], status: 'in-consultation' });
  if (p === `/patients/${ids.patient}`) return data({ patient: patients[0], appointments: [appointments[0]] });
  if (p === `/patients/${ids.patient}/clinical-notes/history`) return data([note]);
  if (p === `/encounters/${ids.visit}/orders`) return data([]);
  if (p === '/soap-templates') return data([{ id: key(902), name: 'General consultation', specialty: 'General Medicine', subjective: {}, objective: {}, assessment: {}, plan: {} }]);
  if (p === '/queue') return data(appointments.filter(visit => visit.doctorId.id === ids.doctor));
  if (p === '/queue/status') return data({ opdSession: { status: 'active', startedAt: at('09:00'), isOnBreak: false }, isAdaptiveDuration: false, averageDuration: 15 });
  if (p === '/queue/delay-status') return data({ isDelayed: false, maxDelayMinutes: 0, affectedCount: 0, delayedPatients: [] });
  if (p === '/doctor-overrides' || p === '/doctor-overrides/triage') return data([]);
  if (p === '/notifications') return data({ notifications, pagination: { page: 1, limit: 15, total: notifications.length, totalPages: 1 }, unreadCount: 3 });
  if (p === '/notifications/unread-count') return data({ unreadCount: 3 });
  if (p === '/billing/plans') return data(plans);
  if (p === '/analytics/daily-summary') return data({ appointments: appointments.length, completed: 2, pending: 5, byStatus: { confirmed: 1, 'checked-in': 2, 'in-consultation': 1, pending: 1, completed: 2, cancelled: 1 }, collections, outstanding, financialVisible: role !== 'doctor', moneyByCurrency: [{ currency: 'INR', collections, outstanding }], recentAppointments: appointments, trends: { days: Array.from({ length: 7 }, (_, index) => ({ day: `2026-10-${18 + index}`, status: 'completed', count: index + 4 })), locations: locations.map((location, index) => ({ locationId: location.id, status: 'confirmed', count: index ? 3 : 5 })) } });
  if (p === '/organization/whatsapp') return data({ mode: 'shared', monthlyQuota: 500, creditsBalance: 382, creditsUsedThisMonth: 118, prepaidCredits: 0, lowBalanceThreshold: 50, isLowBalance: false, autoRechargeEnabled: false, autoRechargePack: null, hasDedicatedCredentials: false, wabaId: '', phoneNumberId: '', notifications: { sendBookingConfirmation: true, sendConsultationComplete: true, sendAppointmentCancellation: true, sendTurnApproaching: true, sendQueueDelayAlert: true, sendDisruptionAlert: true }, availablePacks: [] });
  if (p === '/organization/whatsapp/health') return data({ connection: { enabled: true, configured: true, connectionStatus: 'connected', hasToken: true, hasAppSecret: true, wabaId: '', phoneNumberId: '', verifiedAt: at('09:00'), lastError: null, phoneDisplay: 'Demo shared sender', verifyToken: '', webhookUrl: '' }, templates: [{ name: 'booking_confirmation', language: 'en', status: 'APPROVED', category: 'UTILITY' }, { name: 'turn_approaching', language: 'en', status: 'APPROVED', category: 'UTILITY' }, { name: 'prescription_ready', language: 'en', status: 'APPROVED', category: 'UTILITY' }], today: [{ _id: 'delivered', count: 12 }, { _id: 'read', count: 5 }, { _id: 'accepted', count: 2 }], pending: 1, lastWebhookAt: at('09:58'), issues: [], messages: [{ _id: key(1101), createdAt: at('09:55'), recipientPhone: '••••0041', status: 'delivered', templateId: 'TURN_APPROACHING' }, { _id: key(1102), createdAt: at('09:50'), recipientPhone: '••••0043', status: 'accepted', templateId: 'BOOKING_CONFIRMATION' }, { _id: key(1103), createdAt: at('09:45'), recipientPhone: '••••0046', status: 'read', templateId: 'PRESCRIPTION_READY' }, { _id: key(1104), createdAt: at('09:40'), recipientPhone: '••••0047', status: 'failed', templateId: 'BOOKING_CONFIRMATION', errorReason: 'Illustrative provider rejection' }] });
  const profile = doctors.find(doctor => p === `/public/doctors/${doctor.slug}/profile` || p === `/public/doctors/${doctor.slug}`);
  if (profile) return data({ ...profile, organizationName: organization.name, currency: 'INR', locations: locations.filter(location => location.doctors.some(doctor => doctor.id === profile.id)).map(location => ({ ...location, fees: profile.fees, feeType: 'fixed', logo: null })) });
  const publicLocation = locations.find(location => p === `/public/locations/${location.slug}`);
  if (publicLocation) return data(publicLocation);
  if (/^\/public\/doctors\/[^/]+\/slots$/.test(p)) return data({ slots: ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15'].map(time => ({ time, available: !['10:15', '11:00'].includes(time) })), bookingMode: 'time_slot', isWorkingDay: true, appointmentDuration: 15 });
  // Retain existing broad read contracts for peripheral shell dependencies only.
  return baseFixture(url, role, method, scene);
}
