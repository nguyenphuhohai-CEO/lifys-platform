import nodemailer from 'nodemailer';

export function createMailer(config) {
  const sent = [];
  const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;

  return {
    sent,
    async send({ to, subject, text }) {
      if (!transport) {
        sent.push({ to, subject, text });
        if (config.nodeEnv !== 'test') {
          console.log(`[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
        }
        return;
      }

      await transport.sendMail({ from: config.mailFrom, to, subject, text });
    },
  };
}
