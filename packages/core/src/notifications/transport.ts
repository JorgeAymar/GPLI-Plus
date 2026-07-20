import nodemailer from "nodemailer";

/**
 * Pluggable "how do we actually deliver this" step - same adapter shape as
 * the storage adapter design (LocalFsAdapter/S3Adapter).
 */
export interface NotificationTransport {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

export class ConsoleTransport implements NotificationTransport {
  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    console.log(`[notification] to=${input.to} subject="${input.subject}"\n${input.body}`);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bare URLs in a plain-text body become real clickable links in the HTML version (the body itself is just a template-rendered string, e.g. password-reset's `{{resetLink}}`). */
function linkifyUrls(escapedText: string): string {
  return escapedText.replace(/https?:\/\/[^\s]+/g, (url) => `<a href="${url}" style="color:#0369a1;">${url}</a>`);
}

/** Wraps a plain-text notification body in a minimal branded HTML shell - same accent color and flat, no-shadow visual language as the app itself. Kept deliberately simple: templates stay plain `{{key}}` strings, this is just how the transport renders them for an HTML-capable inbox. */
function renderHtmlBody(plainBody: string): string {
  const html = linkifyUrls(escapeHtml(plainBody)).replace(/\n/g, "<br>");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f9f9f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.1);border-radius:6px;padding:32px 28px;">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#0369a1;margin-bottom:20px;">GLPI-Plus</div>
      <div style="font-size:14px;line-height:1.6;color:#1a1c1c;">${html}</div>
    </div>
  </body>
</html>`;
}

export class SmtpTransport implements NotificationTransport {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }

  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: renderHtmlBody(input.body),
    });
  }
}

/** SMTP if SMTP_HOST is configured, ConsoleTransport (dev/no-op) otherwise - same pattern as createStorageAdapter(). */
export function createNotificationTransport(): NotificationTransport {
  return process.env.SMTP_HOST ? new SmtpTransport() : new ConsoleTransport();
}
