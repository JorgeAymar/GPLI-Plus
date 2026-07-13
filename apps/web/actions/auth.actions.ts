"use server";

import { signIn, signOut } from "@/lib/auth";
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
