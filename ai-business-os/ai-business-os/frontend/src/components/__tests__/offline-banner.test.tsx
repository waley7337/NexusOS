import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "../offline-banner";

const mockUseOnline = vi.fn();

vi.mock("@/hooks/useOnline", () => ({
  useOnline: () => mockUseOnline(),
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    mockUseOnline.mockReset();
  });

  it("renders nothing while online", () => {
    mockUseOnline.mockReturnValue(true);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses warning tokens and does not invent a second alert system", () => {
    mockUseOnline.mockReturnValue(false);
    render(<OfflineBanner />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("You're offline — changes can't be saved.");
    expect(banner.className).toContain("border-warning/40");
    expect(banner.className).toContain("bg-warning/10");
    expect(banner.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
