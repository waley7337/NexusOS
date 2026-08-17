import type { Employee } from "../types";
import type { EmployeeFormValues } from "../schemas/employeeSchema";

export const STATUS_LABEL: Record<Employee["status"], string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

export const STATUS_VARIANT: Record<
  Employee["status"],
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  active: "success",
  on_leave: "warning",
  terminated: "default",
};

export const EMPLOYMENT_LABEL: Record<Employee["employmentType"], string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  intern: "Intern",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function employeeToFormValues(
  initial: Employee | null | undefined,
  currentUserId: string | null,
): EmployeeFormValues {
  if (!initial) {
    return {
      mode: "hr_only",
      firstName: "",
      lastName: "",
      workEmail: "",
      employeeNumber: "",
      department: "",
      managerId: "",
      hireDate: "",
      salaryGrade: "",
      employmentType: "full_time",
      status: "active",
      linkMyAccount: false,
    };
  }

  return {
    mode: initial.userId ? "linked" : "hr_only",
    firstName: initial.firstName,
    lastName: initial.lastName,
    workEmail: initial.workEmail ?? "",
    employeeNumber: initial.employeeNumber,
    department: initial.department ?? "",
    managerId: initial.managerId ?? "",
    hireDate: initial.hireDate ?? "",
    salaryGrade: initial.salaryGrade ?? "",
    employmentType: initial.employmentType,
    status: initial.status,
    linkMyAccount: Boolean(initial.userId && currentUserId && initial.userId === currentUserId),
  };
}

export function managerLabel(
  managerId: string | null,
  lookup: Map<string, Employee>,
): string {
  if (!managerId) return "—";
  const mgr = lookup.get(managerId);
  return mgr ? mgr.fullName : "Assigned";
}
