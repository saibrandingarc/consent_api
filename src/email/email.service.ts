import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { APP_URLS, EMAIL_CONFIG } from '@cmp/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!EMAIL_CONFIG.smtpHost) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: EMAIL_CONFIG.smtpHost,
        port: EMAIL_CONFIG.smtpPort,
        secure: EMAIL_CONFIG.smtpPort === 465,
        auth:
          EMAIL_CONFIG.smtpUser && EMAIL_CONFIG.smtpPass
            ? { user: EMAIL_CONFIG.smtpUser, pass: EMAIL_CONFIG.smtpPass }
            : undefined,
      });
    }
    return this.transporter;
  }

  private async send(to: string, subject: string, html: string) {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
      return;
    }
    await transporter.sendMail({ from: EMAIL_CONFIG.from, to, subject, html });
  }

  async sendVerificationEmail(email: string, token: string) {
    const link = `${APP_URLS.web}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your CMP account',
      `<p>Click to verify your email:</p><p><a href="${link}">${link}</a></p>`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const link = `${APP_URLS.admin}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your CMP password',
      `<p>Click to reset your password:</p><p><a href="${link}">${link}</a></p>`,
    );
  }

  async sendInviteEmail(email: string, token: string, organizationName: string) {
    const link = `${APP_URLS.admin}/reset-password?token=${token}`;
    await this.send(
      email,
      `You've been invited to ${organizationName}`,
      `<p>You've been invited to join <strong>${organizationName}</strong> on CMP.</p>
       <p>Set your password to get started:</p>
       <p><a href="${link}">${link}</a></p>`,
    );
  }

  async sendScheduledReport(email: string, reportType: string, summary: unknown) {
    const preview = JSON.stringify(summary, null, 2).slice(0, 4000);
    await this.send(
      email,
      `CMP scheduled report: ${reportType}`,
      `<p>Your scheduled <strong>${reportType}</strong> report is attached below.</p>
       <pre style="background:#f4f4f5;padding:1rem;overflow:auto;font-size:12px;">${preview}</pre>`,
    );
  }
}
