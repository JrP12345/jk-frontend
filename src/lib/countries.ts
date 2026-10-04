/** Shared operating countries for organization setup and phone sign-in. */
export const COUNTRIES = {
  IN: { name: "India", currency: "INR", timezone: "Asia/Kolkata", callingCode: "+91" },
  US: { name: "United States", currency: "USD", timezone: "America/New_York", callingCode: "+1" },
  CA: { name: "Canada", currency: "CAD", timezone: "America/Toronto", callingCode: "+1" },
  GB: { name: "United Kingdom", currency: "GBP", timezone: "Europe/London", callingCode: "+44" },
  AE: { name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai", callingCode: "+971" },
} as const;

export type CountryCode = keyof typeof COUNTRIES;
export const countryOptions = Object.entries(COUNTRIES).map(([value, country]) => ({ value, label: country.name }));
export const phoneCountryOptions = Object.entries(COUNTRIES).map(([value, country]) => ({ value, label: `${country.name} (${country.callingCode})` }));
