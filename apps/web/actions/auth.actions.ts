"use server";

import { signIn, signOut } from "@/lib/auth";
import {
  consumePasswordResetToken,
  createLoginCode,
  createNotificationTransport,
  createPasswordResetToken,
  findUserByEmail,
  isPasswordResetTokenValid,
  queueNotification,
  verifyPrimaryFactor,
} from "@itsm/core";
import { AuthError } from "next-auth";

export interface LoginState {
  error?: string;
  /** Present once the password has checked out and a code was emailed - the form switches to code entry. */
  step?: "code";
  email?: string;
  password?: string;
  /**
   * Only ever set when E2E_TEST_MODE is on (never in production - see the
   * check below). E2E can't read a real inbox, so this is how
   * e2e/auth.setup.ts completes the real 2-step flow instead of bypassing
   * it - the actual createLoginCode/verifyLoginCode logic still runs.
   */
  debugCode?: string;
}

const GENERIC_LOGIN_ERROR = "Credenciales inválidas";

export async function loginAction(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const code = formData.get("code") as string | null;

  // Phase 2: a code was submitted alongside the (hidden, resubmitted) email/password - verify everything and sign in for real.
  if (code) {
    try {
      await signIn("credentials", { email, password, code, redirectTo: callbackUrl });
      return {};
    } catch (error) {
      if (error instanceof AuthError) {
        return { error: "Código inválido o vencido.", step: "code", email, password };
      }
      // signIn() throws a NEXT_REDIRECT error on success - let it propagate.
      throw error;
    }
  }

  // Phase 1: check the password only, without ever calling signIn (no session yet).
  const user = await verifyPrimaryFactor(email, password);
  if (!user) return { error: GENERIC_LOGIN_ERROR };

  // 2FA is opt-in per user (users.two_factor_enabled) - most users sign in
  // directly here, exactly like before this feature existed.
  if (!user.twoFactorEnabled) {
    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
      return {};
    } catch (error) {
      if (error instanceof AuthError) return { error: GENERIC_LOGIN_ERROR };
      throw error;
    }
  }

  const rawCode = await createLoginCode(user.id);
  const debugCode = process.env.NODE_ENV !== "production" && process.env.E2E_TEST_MODE === "true" ? rawCode : undefined;

  // E2E_TEST_MODE already hands the real code back via `debugCode` - actually
  // sending it adds a real SMTP round trip the test gets no value from, and
  // makes the suite depend on external mail delivery being reachable at all.
  if (!debugCode) {
    await createNotificationTransport().send({
      to: user.email,
      subject: "Tu código de acceso a GLPI-Plus",
      body: `Tu código de verificación es: ${rawCode}\n\nVence en 10 minutos. Si no intentaste iniciar sesión, ignorá este correo.`,
    });
  }
  return { step: "code", email, password, debugCode };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export interface ForgotPasswordState {
  message?: string;
}

/**
 * Always returns the same generic message regardless of whether the email matched a real
 * account - a response that differs ("no existe esa cuenta" vs "revisá tu correo") would let
 * an attacker enumerate valid emails one guess at a time. Only accounts with a local
 * passwordHash get an actual reset link queued; LDAP-only accounts manage their password
 * through the LDAP directory, not through this app, so silently not emailing them is correct,
 * not a bug - the generic response is what keeps that indistinguishable from the outside.
 */
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const genericMessage = "Si ese correo existe en el sistema, te enviamos un link para recuperar tu contraseña.";
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { message: genericMessage };

  const user = await findUserByEmail(email);
  if (user?.passwordHash) {
    const rawToken = await createPasswordResetToken(user.id);
    const resetLink = `${process.env.AUTH_URL ?? "http://localhost:3210"}/reset-password?token=${rawToken}`;
    await queueNotification("password_reset", user.id, { resetLink });
  }

  return { message: genericMessage };
}

export interface ResetPasswordState {
  error?: string;
  success?: boolean;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) return { error: "Link inválido." };
  if (!password || password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };

  const user = await consumePasswordResetToken(token, password);
  if (!user) return { error: "El link expiró o ya fue usado. Solicitá uno nuevo." };

  return { success: true };
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return isPasswordResetTokenValid(token);
}
