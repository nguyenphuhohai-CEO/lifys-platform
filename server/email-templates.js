const TEMPLATES = {
  fr: {
    subject: 'Confirmez votre adresse e-mail Lifys',
    text: (link) => `Bienvenue sur Lifys !\n\nConfirmez votre adresse e-mail en ouvrant ce lien (valable 24 heures) :\n${link}\n\nSi vous n’êtes pas à l’origine de cette inscription, ignorez ce message.`,
  },
  en: {
    subject: 'Confirm your Lifys e-mail address',
    text: (link) => `Welcome to Lifys!\n\nConfirm your e-mail address by opening this link (valid for 24 hours):\n${link}\n\nIf you did not sign up, please ignore this message.`,
  },
  es: {
    subject: 'Confirme su correo electrónico de Lifys',
    text: (link) => `¡Bienvenido a Lifys!\n\nConfirme su correo electrónico abriendo este enlace (válido durante 24 horas):\n${link}\n\nSi no se ha registrado usted, ignore este mensaje.`,
  },
  vi: {
    subject: 'Xác nhận địa chỉ e-mail Lifys của bạn',
    text: (link) => `Chào mừng bạn đến với Lifys!\n\nHãy xác nhận địa chỉ e-mail bằng cách mở liên kết sau (có hiệu lực 24 giờ):\n${link}\n\nNếu bạn không đăng ký, hãy bỏ qua tin nhắn này.`,
  },
};

export function normalizeLang(lang) {
  return typeof lang === 'string' && Object.hasOwn(TEMPLATES, lang) ? lang : 'fr';
}

export function buildVerificationEmail(lang, link) {
  const template = TEMPLATES[normalizeLang(lang)];
  return { subject: template.subject, text: template.text(link) };
}
