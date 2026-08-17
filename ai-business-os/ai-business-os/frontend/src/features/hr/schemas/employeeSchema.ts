import { z } from "zod";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "../types";

export const employeeFormSchema = z
  .object({
    mode: z.enum(["hr_only", "linked"]),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    workEmail: z.string().email("Enter a valid email.").or(z.literal("")).optional(),
    employeeNumber: z.string().min(1, "Employee number is required.").max(40),
    department: z.string().max(120).optional(),
    managerId: z.string().uuid().optional().or(z.literal("")),
    hireDate: z.string().optional(),
    salaryGrade: z.string().max(20).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    status: z.enum(EMPLOYEE_STATUSES),
    linkMyAccount: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "hr_only") {
      if (!data.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "First name is required for HR-only employees.",
          path: ["firstName"],
        });
      }
      if (!data.lastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Last name is required for HR-only employees.",
          path: ["lastName"],
        });
      }
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
