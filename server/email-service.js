function buildVerificationEmail({ appBaseUrl, token, email }) {
  const verificationUrl = `${appBaseUrl}/?verifyEmailToken=${encodeURIComponent(token)}`;
  return {
    subject: 'Vérifiez votre adresse e-mail Lifys',
    html: `<p>Bonjour,</p><p>Confirmez votre adresse e-mail pour activer votre compte Lifys.</p><p><a href="${verificationUrl}">Vérifier mon e-mail</a></p><p>Si le bouton ne fonctionne pas, copiez ce lien :</p><p>${verificationUrl}</p><p>Destinataire : ${email}</p>`,
    text: `Bonjour,\n\nConfirmez votre adresse e-mail pour activer votre compte Lifys : ${verificationUrl}\n\nDestinataire : ${email}`,
  };
}

function buildPasswordResetEmail({ appBaseUrl, token, email }) {
  const resetUrl = `${appBaseUrl}/?resetPasswordToken=${encodeURIComponent(token)}`;
  return {
    subject: 'Réinitialisez votre mot de passe Lifys',
    html: `<p>Bonjour,</p><p>Une demande de réinitialisation de mot de passe a été reçue pour votre compte Lifys.</p><p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p><p>Si le bouton ne fonctionne pas, copiez ce lien :</p><p>${resetUrl}</p><p>Destinataire : ${email}</p>`,
    text: `Bonjour,\n\nRéinitialisez votre mot de passe Lifys : ${resetUrl}\n\nDestinataire : ${email}`,
  };
}

async function sendWithResend(config, payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.resendApiKey,
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email delivery failed with status ${response.status}: ${text}`);
  }
}

export function createEmailService({ config, logger }) {
  function inPreviewMode() {
    return config.emailDeliveryMode === 'preview';
  }

  async function sendEmail({ to, ...template }) {
    if (inPreviewMode()) {
      logger.info('Preview email prepared', { channel: 'email', to, subject: template.subject });
      return { mode: 'preview' };
    }

    await sendWithResend(config, { to, ...template });
    logger.info('Transactional email sent', { channel: 'email', provider: config.emailDeliveryMode, to, subject: template.subject });
    return { mode: config.emailDeliveryMode };
  }

  return {
    mode: config.emailDeliveryMode,
    async sendVerificationEmail({ to, token }) {
      return sendEmail({ to, ...buildVerificationEmail({ appBaseUrl: config.appBaseUrl, token, email: to }) });
    },
    async sendPasswordResetEmail({ to, token }) {
      return sendEmail({ to, ...buildPasswordResetEmail({ appBaseUrl: config.appBaseUrl, token, email: to }) });
    },
  };
}
