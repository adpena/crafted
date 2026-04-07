type Locale = "en" | "es";

interface Translations {
  // Petition
  petition_heading: string;
  petition_first_name: string;
  petition_last_name: string;
  petition_email: string;
  petition_zip: string;
  petition_comment: string;
  petition_submit: string;
  petition_signing: string;
  petition_signed: string;
  petition_signatures: string;

  // Fundraise
  fundraise_custom_amount: string;
  fundraise_donate: string;
  fundraise_donate_amount: string;

  // GOTV
  gotv_pledge_default: string;
  gotv_submit: string;
  gotv_pledging: string;

  // Signup
  signup_email: string;
  signup_name: string;
  signup_submit: string;
  signup_joining: string;

  // Common
  required_field: string;
  invalid_email: string;
  submit_error: string;

  // Disclaimer
  paid_for_by: string;
  treasurer: string;

  // Consent
  consent_data_collection: string;
  consent_privacy_policy: string;
}

const en: Translations = {
  petition_heading: "Sign the Petition",
  petition_first_name: "First name",
  petition_last_name: "Last name",
  petition_email: "Email",
  petition_zip: "ZIP code",
  petition_comment: "Comment (optional)",
  petition_submit: "Sign",
  petition_signing: "Signing...",
  petition_signed: "Signed!",
  petition_signatures: "signatures",

  fundraise_custom_amount: "Other amount",
  fundraise_donate: "Donate",
  fundraise_donate_amount: "Donate ${amount}",

  gotv_pledge_default: "I pledge to vote",
  gotv_submit: "Pledge",
  gotv_pledging: "Pledging...",

  signup_email: "Email",
  signup_name: "Name",
  signup_submit: "Sign up",
  signup_joining: "Joining...",

  required_field: "Required",
  invalid_email: "Enter a valid email",
  submit_error: "Something went wrong. Please try again.",

  paid_for_by: "Paid for by",
  treasurer: "Treasurer",

  consent_data_collection:
    "By submitting, you agree to the collection and use of your data as described in our",
  consent_privacy_policy: "privacy policy",
};

const es: Translations = {
  petition_heading: "Firma la petición",
  petition_first_name: "Nombre",
  petition_last_name: "Apellido",
  petition_email: "Correo electrónico",
  petition_zip: "Código postal",
  petition_comment: "Comentario (opcional)",
  petition_submit: "Firmar",
  petition_signing: "Firmando...",
  petition_signed: "¡Firmado!",
  petition_signatures: "firmas",

  fundraise_custom_amount: "Otra cantidad",
  fundraise_donate: "Donar",
  fundraise_donate_amount: "Donar ${amount}",

  gotv_pledge_default: "Me comprometo a votar",
  gotv_submit: "Comprometerme",
  gotv_pledging: "Comprometiéndome...",

  signup_email: "Correo electrónico",
  signup_name: "Nombre",
  signup_submit: "Suscribirse",
  signup_joining: "Uniéndose...",

  required_field: "Obligatorio",
  invalid_email: "Ingrese un correo electrónico válido",
  submit_error: "Algo salió mal. Inténtelo de nuevo.",

  paid_for_by: "Pagado por",
  treasurer: "Tesorero/a",

  consent_data_collection:
    "Al enviar, acepta la recopilación y el uso de sus datos como se describe en nuestra",
  consent_privacy_policy: "política de privacidad",
};

const translations: Record<Locale, Translations> = { en, es };

export function t(
  locale: Locale,
  key: keyof Translations,
  vars?: Record<string, string>,
): string {
  let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`\${${k}}`, v);
    }
  }
  return text;
}

export function getLocale(requested?: string): Locale {
  if (requested === "es") return "es";
  return "en";
}

export type { Locale, Translations };
