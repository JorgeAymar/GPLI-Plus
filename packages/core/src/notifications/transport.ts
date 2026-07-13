/**
 * Pluggable "how do we actually deliver this" step - same adapter shape as
 * the storage adapter design (LocalFsAdapter/S3Adapter). ConsoleTransport is
 * the only implementation for now; swap in an SmtpTransport/etc. later
 * without touching notification-service.ts's queue/template logic.
 */
export interface NotificationTransport {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

export class ConsoleTransport implements NotificationTransport {
  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    console.log(`[notification] to=${input.to} subject="${input.subject}"\n${input.body}`);
  }
}
