export const COUNTRY_SETTINGS = {
  IN: { label: "India", currency: "INR", defaultTimezone: "Asia/Kolkata", timezones: ["Asia/Kolkata"] },
  US: { label: "United States", currency: "USD", defaultTimezone: null, timezones: ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"] },
  CA: { label: "Canada", currency: "CAD", defaultTimezone: null, timezones: ["America/St_Johns", "America/Halifax", "America/Toronto", "America/Winnipeg", "America/Edmonton", "America/Vancouver"] },
  GB: { label: "United Kingdom", currency: "GBP", defaultTimezone: "Europe/London", timezones: ["Europe/London"] },
  AE: { label: "United Arab Emirates", currency: "AED", defaultTimezone: "Asia/Dubai", timezones: ["Asia/Dubai"] },
} as const;

export type CountryCode = keyof typeof COUNTRY_SETTINGS;

export const countryOptions = Object.entries(COUNTRY_SETTINGS).map(([value, settings]) => ({ value, label: settings.label }));

export function isCountryCode(value: string): value is CountryCode {
  return Object.hasOwn(COUNTRY_SETTINGS, value);
}

export function timezoneOptions(countryCode: string, currentValue?: string) {
  const standard: string[] = isCountryCode(countryCode) ? [...COUNTRY_SETTINGS[countryCode].timezones] : ["Asia/Kolkata", "America/New_York", "America/Toronto", "Europe/London", "Asia/Dubai"];
  if (currentValue && !standard.includes(currentValue)) standard.push(currentValue);
  return standard.map(value => ({ value, label: value }));
}
