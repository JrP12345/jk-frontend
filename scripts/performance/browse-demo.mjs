// Presentation-only cases. No database seed, real people, or provider traffic.
import { locations, doctors } from './landing-demo.mjs';
const base = { ...locations[0], timings: '', phone: '0000000000', email: 'reception@example.test', description: 'Illustrative practice. All details are synthetic.', address: '', organizationLocationCount: 1, minFee: null, rating: null, reviewsCount: 0, images: [], amenities: [], specialties: [] };
const doctor = { ...doctors[0], fees: 500 };
// Synthetic room illustration exercises saved banners without provider traffic.
// The unserved gallery sentinel below must never be downloaded by listings.
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#d5e5dc"/><path d="M0 300H800V400H0Z" fill="#c3ae8e"/><rect x="45" y="40" width="230" height="230" rx="8" fill="#a6c9c3"/><path d="M160 40V270M45 155H275" stroke="#f6f2e8" stroke-width="12"/><rect x="350" y="190" width="340" height="120" rx="10" fill="#f2e9da"/><path d="M360 215H680" stroke="#ab9879" stroke-width="8"/><rect x="450" y="145" width="75" height="48" rx="4" fill="#456a61"/><path d="M745 265V140M745 205Q685 180 710 145Q745 150 745 205M745 180Q800 145 780 115Q748 125 745 180" fill="#668b7a" stroke="#547969" stroke-width="6"/><path d="M714 265H775L762 320H727Z" fill="#dfd3ba"/></svg>');
const logo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" rx="12" fill="#1f5c52"/><text x="28" y="35" font-family="sans-serif" font-size="23" text-anchor="middle" fill="#f6f2e8">AG</text></svg>');
export const browseCases = [
  { ...base, name: 'Aster Grove Clinic', image_url: cover, images: ['/unused-directory-gallery.svg'], logo_url: logo, specialties: ['General Medicine', 'Family Medicine'], doctorCount: 1, doctors: [doctor], doctorsSummary: [doctor], phone: '+91 00000 00000', email: 'hello@example.test', address: '204, Demonstration Medical Centre, Baner Road', city: 'Pune' },
  { ...base, id: 'hospital', slug: 'river-hospital', name: 'River Hospital and Specialist Care', facilityType: 'hospital', address: 'Riverside Avenue', city: 'Pune', specialties: ['Pediatrics', 'General Medicine'], doctorCount: 3, doctors, doctorsSummary: doctors, minFee: 500, rating: 4.7, reviewsCount: 21, logo_url: '/brand/ekavyu-mark.svg?v=brand-5' },
  { ...base, id: 'paused', slug: 'orchard-clinic', name: 'Orchard Clinic', doctorCount: 1, doctors: [doctor], doctorsSummary: [doctor], onlineBookingAvailable: false, bookingStatus: 'contact_location', city: 'Surat', phone: '', email: '' },
  { ...base, id: 'phone', slug: 'cedar-clinic', name: 'Cedar Clinic', doctorCount: 1, doctors: [doctor], doctorsSummary: [{ ...doctor, feeType: 'free', fees: 0 }], onlineBookingAvailable: false, bookingStatus: 'contact_location', phone: '0000000000', city: 'Surat' },
  { ...base, id: 'diagnostic', slug: 'valley-diagnostics', name: 'Valley Diagnostics', facilityType: 'diagnostic_center', doctorCount: 0, doctors: [], doctorsSummary: [], onlineBookingAvailable: true, bookingStatus: 'no_doctors', city: 'Pune' },
  { ...base, id: 'long', slug: 'long-name', name: 'The Centre for Comprehensive Family Medicine, Preventive Care and Specialist Consultations', phone: '+91 (000) 000-0000', email: 'appointments.familymedicine@example.test', doctorCount: 1, doctors: [doctor], doctorsSummary: [{ ...doctor, name: 'An exceptionally long fictional practitioner name for responsive coverage', specialization: 'General Medicine and Preventive Healthcare', feeType: 'post_consultation', fees: 750 }], address: 'A very long illustrative street address near the community healthcare centre and residential gardens', city: 'Pune' },
  { ...base, id: 'partial', slug: 'partial', name: 'Partial listing', facilityType: null, doctorCount: undefined, doctors: [], doctorsSummary: [], city: '', onlineBookingAvailable: false, rating: 5, reviewsCount: 0, logo_url: '/missing-demo-logo.png' },
  { ...base, id: 'unpublished-link', slug: undefined, name: 'Profile link pending', doctorCount: 1, doctors: [doctor], doctorsSummary: [doctor], city: 'Pune' },
];

// Separate public-profile fixture: never persisted to the application's database.
export const facilityProfile = {
  googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=synthetic-map-preview',
  ...browseCases[0], description: 'Illustrative community practice offering general medicine, pediatric and dermatology consultations. All people, contact details and images in this preview are synthetic.',
  organizationLocationCount: 2, organization: { id: 'demo-org', name: 'Aster Grove Medical Centre' },
  timings: JSON.stringify(Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => [day, [{ start: '09:00', end: '17:00' }]]))),
  amenities: ['Step-free entrance', 'Patient waiting area'], images: [cover, cover],
  doctors: doctors.map((doctor, index) => ({ ...doctor, timings: '', working_days: '', description: '', image_url: '', fees: [500, 600, 700][index], feeType: index === 2 ? 'post_consultation' : 'fixed' })),
};

export function filterBrowseCases(url, mode) {
  if (mode === 'empty') return [];
  let rows = mode === 'single' ? [browseCases[0]] : browseCases;
  const query = url.searchParams.get('search')?.toLowerCase();
  const city = url.searchParams.get('city');
  const specialty = url.searchParams.get('specialization');
  if (query) rows = rows.filter(row => `${row.name} ${row.city} ${row.doctorsSummary.map(doc => `${doc.name} ${doc.specialization}`).join(' ')}`.toLowerCase().includes(query));
  if (city) rows = rows.filter(row => row.city === city);
  if (specialty) rows = rows.filter(row => row.doctorsSummary.some(doc => doc.specialization === specialty));
  return rows;
}
