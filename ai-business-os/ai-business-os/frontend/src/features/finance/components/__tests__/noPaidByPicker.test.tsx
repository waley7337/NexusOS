import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpenseForm } from "../ExpenseForm";
import { PaymentForm } from "../PaymentForm";

describe("Payment attribution UX constraint", () => {
  it("ExpenseForm does not expose a paid-by picker", () => {
    render(
      <ExpenseForm
        busy={false}
        errors={null}
        onErrorsChange={() => undefined}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/paid by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/paid by/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /paid by/i })).not.toBeInTheDocument();
  });

  it("PaymentForm does not expose a paid-by picker", () => {
    render(
      <PaymentForm
        currency="USD"
        busy={false}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/paid by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/paid by/i)).not.toBeInTheDocument();
  });
});
