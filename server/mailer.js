import nodemailer from 'nodemailer';

export function createMailer(config) {
  const sent = [];
  const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;

  return {
    sent,
    async verify() {
      if (!transport) return false;
      await transport.verify();
      return true;
    },
    async send({ to, subject, text, html }) {
      if (!transport) {
        sent.push({ to, subject, text, html });
        if (config.nodeEnv !== 'test') {
          console.log(`[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
        }
        return;
      }

      await transport.sendMail({ from: config.mailFrom, to, subject, text, ...(html ? { html } : {}) });
    },
  };
}
