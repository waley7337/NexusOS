/**
 * Stripe Payment Element confirm form — card data never touches NexusOS servers.
 */
import { useState, type FormEvent } from "react";
import {
  BillingAddressElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CheckoutPaymentFormProps {
  submitLabel: string;
}

export function CheckoutPaymentForm({ submitLabel }: CheckoutPaymentFormProps) {
  const checkoutState = useCheckoutElements();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-3" aria-label="Loading payment form" aria-busy="true">
        <Skeleton className="h-10" />
        <Skeleton className="h-28" />
        <Skeleton className="h-11" />
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="text-sm text-destructive" role="alert">
        {checkoutState.error.message || "Payment form failed to load."}
      </p>
    );
  }

  const { checkout } = checkoutState;
  const totalLabel =
    checkout.total?.total?.amount != null
      ? String(checkout.total.total.amount)
      : null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await checkout.confirm();
      if (result.type === "error") {
        setMessage(result.error.message ?? "Payment could not be confirmed.");
      }
      // Success redirects to return_url — keep submitting state until unmount.
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Payment could not be confirmed.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Payment method</h2>
        <p className="text-xs text-muted-foreground">
          Card details are entered in Stripe&apos;s secure Payment Element and never
          sent through NexusOS.
        </p>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Billing details</h2>
        <BillingAddressElement />
      </div>

      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={submitting}
        className="h-11 w-full"
        disabled={!checkout.canConfirm}
      >
        {submitting
          ? "Confirming…"
          : totalLabel
            ? `${submitLabel} · ${totalLabel}`
            : submitLabel}
      </Button>
    </form>
  );
}
