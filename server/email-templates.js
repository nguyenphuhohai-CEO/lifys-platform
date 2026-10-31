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

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const BUTTONS = { fr: 'Confirmer mon e-mail', en: 'Confirm my e-mail', es: 'Confirmar mi correo', vi: 'Xác nhận e-mail' };

export function wrapHtml({ title, paragraphs, button, link, footer = '' }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1ec;font-family:Arial,Helvetica,sans-serif;color:#1f2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#6646c8;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold">Lifys</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="line-height:1.5;margin:0 0 14px">${escapeHtml(p)}</p>`).join('')}
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#6646c8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(button)}</a></p>
<p style="font-size:12px;color:#637081;margin:0">${footer}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function buildVerificationEmail(lang, link) {
  const code = normalizeLang(lang);
  const template = TEMPLATES[code];
  const [intro, ...rest] = template.text(link).split('\n\n');
  return {
    subject: template.subject,
    text: template.text(link),
    html: wrapHtml({ title: template.subject, paragraphs: [intro, rest.at(-1)].filter(Boolean), button: BUTTONS[code], link }),
  };
}
