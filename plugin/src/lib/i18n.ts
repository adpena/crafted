type Locale = "en" | "es" | "zh" | "vi" | "ko" | "tl" | "fr" | "ar";

interface Translations {
  // Petition
  petition_heading: string;
  petition_tell: string;
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
  petition_tell: "Tell",
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
  consent_data_collection: "By submitting, you agree to the collection and use of your data as described in our",
  consent_privacy_policy: "privacy policy",
};

const es: Translations = {
  petition_heading: "Firma la petición",
  petition_tell: "Dile a",
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
  consent_data_collection: "Al enviar, acepta la recopilación y el uso de sus datos como se describe en nuestra",
  consent_privacy_policy: "política de privacidad",
};

const zh: Translations = {
  petition_heading: "签署请愿书",
  petition_tell: "告诉",
  petition_first_name: "名",
  petition_last_name: "姓",
  petition_email: "电子邮件",
  petition_zip: "邮政编码",
  petition_comment: "留言（可选）",
  petition_submit: "签名",
  petition_signing: "签名中...",
  petition_signed: "已签名！",
  petition_signatures: "签名",
  fundraise_custom_amount: "其他金额",
  fundraise_donate: "捐款",
  fundraise_donate_amount: "捐款 $${amount}",
  gotv_pledge_default: "我承诺去投票",
  gotv_submit: "承诺",
  gotv_pledging: "承诺中...",
  signup_email: "电子邮件",
  signup_name: "姓名",
  signup_submit: "注册",
  signup_joining: "加入中...",
  required_field: "必填",
  invalid_email: "请输入有效的电子邮件",
  submit_error: "出现错误，请重试。",
  paid_for_by: "由以下机构资助",
  treasurer: "财务主管",
  consent_data_collection: "提交即表示您同意按照我们的",
  consent_privacy_policy: "隐私政策",
};

const vi: Translations = {
  petition_heading: "Ký tên thỉnh nguyện",
  petition_tell: "Gửi đến",
  petition_first_name: "Tên",
  petition_last_name: "Họ",
  petition_email: "Email",
  petition_zip: "Mã bưu điện",
  petition_comment: "Bình luận (không bắt buộc)",
  petition_submit: "Ký tên",
  petition_signing: "Đang ký...",
  petition_signed: "Đã ký!",
  petition_signatures: "chữ ký",
  fundraise_custom_amount: "Số tiền khác",
  fundraise_donate: "Quyên góp",
  fundraise_donate_amount: "Quyên góp $${amount}",
  gotv_pledge_default: "Tôi cam kết đi bầu cử",
  gotv_submit: "Cam kết",
  gotv_pledging: "Đang cam kết...",
  signup_email: "Email",
  signup_name: "Tên",
  signup_submit: "Đăng ký",
  signup_joining: "Đang tham gia...",
  required_field: "Bắt buộc",
  invalid_email: "Vui lòng nhập email hợp lệ",
  submit_error: "Đã xảy ra lỗi. Vui lòng thử lại.",
  paid_for_by: "Được tài trợ bởi",
  treasurer: "Thủ quỹ",
  consent_data_collection: "Bằng cách gửi, bạn đồng ý với việc thu thập và sử dụng dữ liệu theo",
  consent_privacy_policy: "chính sách bảo mật",
};

const ko: Translations = {
  petition_heading: "청원서 서명",
  petition_tell: "전달 대상:",
  petition_first_name: "이름",
  petition_last_name: "성",
  petition_email: "이메일",
  petition_zip: "우편번호",
  petition_comment: "댓글 (선택사항)",
  petition_submit: "서명",
  petition_signing: "서명 중...",
  petition_signed: "서명 완료!",
  petition_signatures: "서명",
  fundraise_custom_amount: "기타 금액",
  fundraise_donate: "기부",
  fundraise_donate_amount: "$${amount} 기부",
  gotv_pledge_default: "투표하겠습니다",
  gotv_submit: "서약",
  gotv_pledging: "서약 중...",
  signup_email: "이메일",
  signup_name: "이름",
  signup_submit: "가입",
  signup_joining: "가입 중...",
  required_field: "필수",
  invalid_email: "유효한 이메일을 입력하세요",
  submit_error: "오류가 발생했습니다. 다시 시도해 주세요.",
  paid_for_by: "후원:",
  treasurer: "회계 담당자",
  consent_data_collection: "제출 시 당사의",
  consent_privacy_policy: "개인정보 처리방침",
};

const tl: Translations = {
  petition_heading: "Pirmahan ang Petisyon",
  petition_tell: "Sabihin sa",
  petition_first_name: "Pangalan",
  petition_last_name: "Apelyido",
  petition_email: "Email",
  petition_zip: "ZIP code",
  petition_comment: "Komento (opsyonal)",
  petition_submit: "Pirmahan",
  petition_signing: "Pinipirmahan...",
  petition_signed: "Napirmahan!",
  petition_signatures: "pirma",
  fundraise_custom_amount: "Ibang halaga",
  fundraise_donate: "Mag-donate",
  fundraise_donate_amount: "Mag-donate ng $${amount}",
  gotv_pledge_default: "Nangangako akong bumoto",
  gotv_submit: "Mangako",
  gotv_pledging: "Nangangako...",
  signup_email: "Email",
  signup_name: "Pangalan",
  signup_submit: "Mag-sign up",
  signup_joining: "Sumasali...",
  required_field: "Kinakailangan",
  invalid_email: "Maglagay ng wastong email",
  submit_error: "May nangyaring mali. Subukan ulit.",
  paid_for_by: "Pinondohan ng",
  treasurer: "Ingat-yaman",
  consent_data_collection: "Sa pag-submit, sumasang-ayon ka sa pagkolekta at paggamit ng iyong datos ayon sa aming",
  consent_privacy_policy: "patakaran sa privacy",
};

const fr: Translations = {
  petition_heading: "Signez la pétition",
  petition_tell: "Dites à",
  petition_first_name: "Prénom",
  petition_last_name: "Nom",
  petition_email: "Courriel",
  petition_zip: "Code postal",
  petition_comment: "Commentaire (facultatif)",
  petition_submit: "Signer",
  petition_signing: "Signature en cours...",
  petition_signed: "Signé !",
  petition_signatures: "signatures",
  fundraise_custom_amount: "Autre montant",
  fundraise_donate: "Faire un don",
  fundraise_donate_amount: "Donner ${amount} $",
  gotv_pledge_default: "Je m'engage à voter",
  gotv_submit: "S'engager",
  gotv_pledging: "Engagement en cours...",
  signup_email: "Courriel",
  signup_name: "Nom",
  signup_submit: "S'inscrire",
  signup_joining: "Inscription...",
  required_field: "Obligatoire",
  invalid_email: "Entrez un courriel valide",
  submit_error: "Une erreur est survenue. Veuillez réessayer.",
  paid_for_by: "Payé par",
  treasurer: "Trésorier/ère",
  consent_data_collection: "En soumettant, vous acceptez la collecte et l'utilisation de vos données conformément à notre",
  consent_privacy_policy: "politique de confidentialité",
};

const ar: Translations = {
  petition_heading: "وقّع العريضة",
  petition_tell: "أخبر",
  petition_first_name: "الاسم الأول",
  petition_last_name: "اسم العائلة",
  petition_email: "البريد الإلكتروني",
  petition_zip: "الرمز البريدي",
  petition_comment: "تعليق (اختياري)",
  petition_submit: "وقّع",
  petition_signing: "جارٍ التوقيع...",
  petition_signed: "تم التوقيع!",
  petition_signatures: "توقيعات",
  fundraise_custom_amount: "مبلغ آخر",
  fundraise_donate: "تبرع",
  fundraise_donate_amount: "تبرع بمبلغ $${amount}",
  gotv_pledge_default: "أتعهد بالتصويت",
  gotv_submit: "تعهد",
  gotv_pledging: "جارٍ التعهد...",
  signup_email: "البريد الإلكتروني",
  signup_name: "الاسم",
  signup_submit: "اشترك",
  signup_joining: "جارٍ الانضمام...",
  required_field: "مطلوب",
  invalid_email: "أدخل بريدًا إلكترونيًا صالحًا",
  submit_error: "حدث خطأ. يرجى المحاولة مرة أخرى.",
  paid_for_by: "مموّل من",
  treasurer: "أمين الصندوق",
  consent_data_collection: "بالإرسال، أنت توافق على جمع واستخدام بياناتك كما هو موضح في",
  consent_privacy_policy: "سياسة الخصوصية",
};

const translations: Record<Locale, Translations> = { en, es, zh, vi, ko, tl, fr, ar };

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
  const supported: Locale[] = ["en", "es", "zh", "vi", "ko", "tl", "fr", "ar"];
  if (requested && supported.includes(requested as Locale)) return requested as Locale;
  return "en";
}

export type { Locale, Translations };
