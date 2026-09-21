export type LanguageCode = "en" | "hi" | "gu" | "mr";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: "ltr" | "rtl";
}

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇮🇳", dir: "ltr" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🇮🇳", dir: "ltr" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", flag: "🇮🇳", dir: "ltr" },
];

export function isSupportedLanguage(code: unknown): code is LanguageCode {
  if (typeof code !== "string") return false;
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}
