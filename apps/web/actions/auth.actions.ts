"use server";

import { signIn, signOut } from "@/lib/auth";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  findUserByEmail,
  isPasswordResetTokenValid,
  queueNotification,
} from "@itsm/core";
import { AuthError } from "next-auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("callbackUrl") as string) || "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Credenciales inválidas" };
    }
    // signIn() throws a NEXT_REDIRECT error on success - let it propagate.
    throw error;
  }
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
