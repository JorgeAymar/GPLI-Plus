import { isPasswordResetTokenValid } from "@itsm/core";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Restablecer contraseña" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = token ? await isPasswordResetTokenValid(token) : false;

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="w-full max-w-sm space-y-4 rounded-md border border-black/10 p-8 text-center dark:border-white/10">
          <h1 className="text-2xl font-semibold">Link inválido</h1>
          <p className="text-sm opacity-70">Este link para restablecer tu contraseña expiró o ya fue usado.</p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Solicitar uno nuevo
          </Link>
        </div>
      )}
    </div>
  );
}
