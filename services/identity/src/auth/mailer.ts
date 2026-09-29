import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@feedants/server-kit';
import { createTransport, type Transporter } from 'nodemailer';
import type { IdentityEnv } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export abstract class Mailer {
  abstract send(mail: Mail): Promise<void>;
}

/** SMTP: Mailpit locally; SES SMTP or Resend SMTP in production, chosen by config (R-13). */
@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport: Transporter;

  constructor(@Inject(ENV) private readonly env: IdentityEnv) {
    super();
    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.env.MAIL_FROM, ...mail });
  }
}

export function otpMail(to: string, code: string, ttlMinutes: number): Mail {
  return {
    to,
    subject: `${code} is your Feedants sign-in code`,
    text: `Your Feedants sign-in code is ${code}.\n\nIt expires in ${ttlMinutes} minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Feedants sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${ttlMinutes} minutes. If you didn't ask for it, you can ignore this email.</p>`,
  };
}
