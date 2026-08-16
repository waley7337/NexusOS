import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Input } from "../input";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field label="Work email" required>
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/Work email/);
    expect(input).toBeRequired();
  });

  it("announces errors via role=alert and aria-invalid", () => {
    render(
      <Field label="Work email" error="Enter a valid email address">
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
    const input = screen.getByLabelText(/Work email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage");
    expect(input).toHaveAccessibleDescription("Enter a valid email address");
  });

  it("keeps the label associated when a label accessory is present", () => {
    render(
      <Field label="Password" labelAccessory={<a href="/forgot">Forgot password?</a>}>
        <Input type="password" />
      </Field>,
    );
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeInTheDocument();
  });
});
