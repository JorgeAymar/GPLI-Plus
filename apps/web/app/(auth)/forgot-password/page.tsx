import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <ForgotPasswordForm />
    </div>
  );
}
