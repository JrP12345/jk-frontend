"use client";

import { create } from "zustand";

export type LanguageCode = "en" | "hi" | "es" | "ar";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: "ltr" | "rtl";
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", dir: "rtl" },
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Nav & Marketplace
    "nav.search_placeholder": "Search hospitals, clinics, specialists...",
    "nav.browse": "Browse Clinics",
    "nav.queue_tv": "Queue TV",
    "nav.track_visit": "Track Visit",
    "nav.patient_portal": "Patient Portal",
    "nav.staff_login": "Staff Login",
    "nav.dashboard": "Dashboard",
    "nav.logout": "Log Out",
    "nav.profile": "Profile & Settings",

    // Common Actions
    "action.book_appointment": "Book Appointment",
    "action.continue": "Continue",
    "action.confirm": "Confirm Appointment",
    "action.cancel": "Cancel",
    "action.back": "Back",
    "action.close": "Close",
    "action.call": "Call Clinic",
    "action.directions": "Directions",
    "action.share": "Share",
    "action.whatsapp": "WhatsApp",
    "action.save": "Save Changes",
    "action.view_all": "View All",

    // Status & Badges
    "status.open_today": "Open Today",
    "status.closed": "Closed",
    "status.available": "Available",
    "status.unavailable": "Unavailable",
    "status.free": "Free Consultation",

    // Clinical & Browse
    "browse.title": "Find Verified Healthcare Providers",
    "browse.subtitle": "Search top-rated clinics, hospital departments, and book verified doctor appointments.",
    "browse.all_specialties": "All Specializations",
    "browse.experience": "Experience",
    "browse.consultation_fee": "Consultation Fee",
    "browse.select_date": "1. Select Date",
    "browse.select_time": "2. Select Time Slot",
    "browse.patient_info": "Patient Information",
    "browse.full_name": "Full Name",
    "browse.mobile_number": "Mobile Phone Number",
    "browse.email": "Email Address",

    // General
    "common.language": "Language",
    "common.currency": "Currency",
  },
  hi: {
    // Nav & Marketplace
    "nav.search_placeholder": "अस्पताल, क्लिनिक, विशेषज्ञ खोजें...",
    "nav.browse": "क्लिनिक देखें",
    "nav.queue_tv": "कतार टीवी",
    "nav.track_visit": "अपॉइंटमेंट ट्रैक करें",
    "nav.patient_portal": "मरीज़ पोर्टल",
    "nav.staff_login": "स्टाफ लॉगिन",
    "nav.dashboard": "डैशबोर्ड",
    "nav.logout": "लॉग आउट",
    "nav.profile": "प्रोफ़ाइल और सेटिंग्स",

    // Common Actions
    "action.book_appointment": "अपॉइंटमेंट बुक करें",
    "action.continue": "आगे बढ़ें",
    "action.confirm": "अपॉइंटमेंट कन्फर्म करें",
    "action.cancel": "रद्द करें",
    "action.back": "पीछे जाएं",
    "action.close": "बंद करें",
    "action.call": "कॉल करें",
    "action.directions": "दिशा-निर्देश",
    "action.share": "शेयर करें",
    "action.whatsapp": "व्हाट्सएप",
    "action.save": "सुरक्षित करें",
    "action.view_all": "सभी देखें",

    // Status & Badges
    "status.open_today": "आज खुला है",
    "status.closed": "बंद है",
    "status.available": "उपलब्ध",
    "status.unavailable": "अनुपलब्ध",
    "status.free": "मुफ्त परामर्श",

    // Clinical & Browse
    "browse.title": "सत्यापित स्वास्थ्य सेवा प्रदाता खोजें",
    "browse.subtitle": "शीर्ष क्लिनिक खोजें और अनुभवी डॉक्टरों से परामर्श के लिए तुरंत अपॉइंटमेंट बुक करें।",
    "browse.all_specialties": "सभी विशेषज्ञताएं",
    "browse.experience": "अनुभव",
    "browse.consultation_fee": "परामर्श शुल्क",
    "browse.select_date": "1. तारीख चुनें",
    "browse.select_time": "2. समय स्लॉट चुनें",
    "browse.patient_info": "मरीज़ की जानकारी",
    "browse.full_name": "पूरा नाम",
    "browse.mobile_number": "मोबाइल नंबर",
    "browse.email": "ईमेल पता",

    // General
    "common.language": "भाषा",
    "common.currency": "मुद्रा",
  },
  es: {
    // Nav & Marketplace
    "nav.search_placeholder": "Buscar hospitales, clínicas, médicos...",
    "nav.browse": "Explorar Clínicas",
    "nav.queue_tv": "Turnos TV",
    "nav.track_visit": "Seguimiento",
    "nav.patient_portal": "Portal del Paciente",
    "nav.staff_login": "Acceso Personal",
    "nav.dashboard": "Panel",
    "nav.logout": "Cerrar Sesión",
    "nav.profile": "Perfil y Ajustes",

    // Common Actions
    "action.book_appointment": "Reservar Cita",
    "action.continue": "Continuar",
    "action.confirm": "Confirmar Cita",
    "action.cancel": "Cancelar",
    "action.back": "Atrás",
    "action.close": "Cerrar",
    "action.call": "Llamar",
    "action.directions": "Cómo llegar",
    "action.share": "Compartir",
    "action.whatsapp": "WhatsApp",
    "action.save": "Guardar",
    "action.view_all": "Ver Todo",

    // Status & Badges
    "status.open_today": "Abierto hoy",
    "status.closed": "Cerrado",
    "status.available": "Disponible",
    "status.unavailable": "No disponible",
    "status.free": "Consulta Gratuita",

    // Clinical & Browse
    "browse.title": "Encuentre Centros Médicos Certificados",
    "browse.subtitle": "Reserve citas con los mejores especialistas de su región.",
    "browse.all_specialties": "Todas las Especialidades",
    "browse.experience": "Experiencia",
    "browse.consultation_fee": "Tarifa de Consulta",
    "browse.select_date": "1. Seleccione Fecha",
    "browse.select_time": "2. Seleccione Horario",
    "browse.patient_info": "Datos del Paciente",
    "browse.full_name": "Nombre Completo",
    "browse.mobile_number": "Teléfono Móvil",
    "browse.email": "Correo Electrónico",

    // General
    "common.language": "Idioma",
    "common.currency": "Moneda",
  },
  ar: {
    // Nav & Marketplace
    "nav.search_placeholder": "ابحث عن المستشفيات والعيادات والأطباء...",
    "nav.browse": "تصفح العيادات",
    "nav.queue_tv": "شاشة الانتظار",
    "nav.track_visit": "تتبع الموعد",
    "nav.patient_portal": "بوابة المريض",
    "nav.staff_login": "تسجيل دخول الموظفين",
    "nav.dashboard": "لوحة التحكم",
    "nav.logout": "تسجيل الخروج",
    "nav.profile": "الملف الشخصي والإعدادات",

    // Common Actions
    "action.book_appointment": "حجز موعد",
    "action.continue": "متابعة",
    "action.confirm": "تأكيد الموعد",
    "action.cancel": "إلغاء",
    "action.back": "رجوع",
    "action.close": "إغلاق",
    "action.call": "اتصال بالعيادة",
    "action.directions": "الاتجاهات",
    "action.share": "مشاركة",
    "action.whatsapp": "واتساب",
    "action.save": "حفظ",
    "action.view_all": "عرض الكل",

    // Status & Badges
    "status.open_today": "مفتوح اليوم",
    "status.closed": "مغلق",
    "status.available": "متاح",
    "status.unavailable": "غير متاح",
    "status.free": "استشارة مجانية",

    // Clinical & Browse
    "browse.title": "ابحث عن مقدمي الرعاية الصحية المعتمدين",
    "browse.subtitle": "احجز مواعيد فورية مع نخبة الأطباء والاستشاريين المعتمدين.",
    "browse.all_specialties": "جميع التخصصات",
    "browse.experience": "الخبرة",
    "browse.consultation_fee": "رسوم الاستشارة",
    "browse.select_date": "١. اختر التاريخ",
    "browse.select_time": "٢. اختر الوقت",
    "browse.patient_info": "بيانات المريض",
    "browse.full_name": "الاسم الكامل",
    "browse.mobile_number": "رقم الهاتف المحمول",
    "browse.email": "البريد الإلكتروني",

    // General
    "common.language": "اللغة",
    "common.currency": "العملة",
  },
};

interface I18nState {
  language: LanguageCode;
  isHydrated: boolean;
  initLanguage: () => void;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultText?: string) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  language: "en",
  isHydrated: false,

  initLanguage: () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ananta_lang") as LanguageCode;
        if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
          const option = SUPPORTED_LANGUAGES.find((l) => l.code === saved);
          document.documentElement.lang = saved;
          document.documentElement.dir = option?.dir || "ltr";
          set({ language: saved, isHydrated: true });
          return;
        }
      } catch {}
      set({ isHydrated: true });
    }
  },

  setLanguage: (language: LanguageCode) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ananta_lang", language);
      } catch {}
      const option = SUPPORTED_LANGUAGES.find((l) => l.code === language);
      document.documentElement.lang = language;
      document.documentElement.dir = option?.dir || "ltr";
    }
    set({ language, isHydrated: true });
  },

  t: (key: string, defaultText?: string) => {
    const lang = get().language || "en";
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || defaultText || key;
  },
}));

export function useTranslation() {
  const language = useI18nStore((s) => s.language);
  const isHydrated = useI18nStore((s) => s.isHydrated);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const t = useI18nStore((s) => s.t);

  return { language, isHydrated, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES };
}
