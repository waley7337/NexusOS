/**
 * Centered brand shell for login / register / password reset.
 * Renders on NexusOS's jet-black auth surface (see `.dark.auth-shell`
 * in globals.css) regardless of the viewer's light/dark preference —
 * every control below (Field, Input, Button, Label) is unmodified and
 * simply reads the scoped tokens, so behavior and a11y are untouched.
 */
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { fadeInUp } from "@/lib/motion";

export function AuthLayout() {
  return (
    <div className="dark auth-shell auth-page">
      <div className="auth-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="auth-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="relative flex w-full flex-col items-center"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-card bg-primary text-primary-foreground shadow-sm">
            <span className="text-h4">N</span>
          </div>
          <span className="text-body font-semibold tracking-tight text-foreground">NexusOS</span>
        </div>

        <div className="w-full max-w-[400px] rounded-dialog border bg-card p-8 shadow-lg sm:p-10">
          <Outlet />
        </div>

        <p className="mt-8 flex items-center gap-1.5 text-small text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Secured with enterprise-grade encryption
        </p>
      </motion.div>
    </div>
  );
}
