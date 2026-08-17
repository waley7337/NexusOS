import { describe, expect, it } from "vitest";
import { leadFormSchema } from "../leadSchema";

const VALID_CUSTOMER = "11111111-1111-4111-8111-111111111111";

describe("leadFormSchema", () => {
  it("requires customer and accepts real LeadCreate fields", () => {
    const result = leadFormSchema.safeParse({
      customerId: VALID_CUSTOMER,
      pipelineStage: "qualified",
      estimatedValue: "1500.50",
      probability: "40",
      expectedCloseDate: "2026-12-01",
      assigneeMode: "me",
      notes: "Discovery",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("companyId");
      expect(result.data).not.toHaveProperty("id");
      expect(result.data.pipelineStage).toBe("qualified");
    }
  });

  it("rejects invalid probability and invented stages", () => {
    expect(
      leadFormSchema.safeParse({
        customerId: VALID_CUSTOMER,
        pipelineStage: "hot",
        estimatedValue: "",
        probability: "",
        expectedCloseDate: "",
        assigneeMode: "unassigned",
        notes: "",
      }).success,
    ).toBe(false);

    expect(
      leadFormSchema.safeParse({
        customerId: VALID_CUSTOMER,
        pipelineStage: "new",
        estimatedValue: "",
        probability: "150",
        expectedCloseDate: "",
        assigneeMode: "unassigned",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("accepts zero estimated value and rejects negative amounts", () => {
    expect(
      leadFormSchema.safeParse({
        customerId: VALID_CUSTOMER,
        pipelineStage: "new",
        estimatedValue: "0",
        probability: "",
        expectedCloseDate: "",
        assigneeMode: "unassigned",
        notes: "",
      }).success,
    ).toBe(true);

    const negative = leadFormSchema.safeParse({
      customerId: VALID_CUSTOMER,
      pipelineStage: "new",
      estimatedValue: "-100",
      probability: "",
      expectedCloseDate: "",
      assigneeMode: "unassigned",
      notes: "",
    });
    expect(negative.success).toBe(false);
    if (!negative.success) {
      expect(negative.error.issues.some((i) => i.message === "Amount must be zero or greater")).toBe(
        true,
      );
    }
  });
});
