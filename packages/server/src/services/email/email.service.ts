import { getLogger } from '@kai/unified-logger';

const logger = getLogger('email-service');

interface EmailOptions {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

class EmailService {
  constructor() {
    logger.warn('EmailService is using a mock implementation. No emails will be sent.');
  }

  /**
   * Sends an email.
   *
   * @param options - The email options.
   * @returns A promise that resolves when the email is "sent".
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    logger.warn(`Mock Email Sent:
      To: ${options.to}
      Subject: ${options.subject}
      Body (HTML): ${options.html.substring(0, 100)}...
    `);
    // In a real implementation, you would integrate with an email provider like SendGrid, Postmark, or AWS SES.
    // For example:
    // await this.emailProvider.send({
    //   to: options.to,
    //   from: 'noreply@example.com',
    //   subject: options.subject,
    //   html: options.html,
    //   text: options.text,
    // });
    return Promise.resolve();
  }
}

export const emailService = new EmailService();