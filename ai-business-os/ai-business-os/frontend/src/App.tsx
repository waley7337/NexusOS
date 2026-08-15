import { MotionConfig } from "framer-motion";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthEntryOverlay } from "@/components/auth-entry-overlay";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { router } from "@/routes";

export default function App() {
  return (
    // reducedMotion="user" (Part 04 convergence, Commit E). Framer Motion
    // animates through inline styles from JS, so the CSS
    // prefers-reduced-motion rules in globals.css cannot reach it — without
    // this, Framer Motion in the shell would still slide for a user who
    // asked it not to. "user" drops transform/layout animation
    // while keeping opacity, which is the behaviour WCAG actually asks for.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryProvider>
          <RouterProvider router={router} />
          <AuthEntryOverlay />
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "border-line-soft shadow-dropdown",
              },
            }}
          />
        </QueryProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
