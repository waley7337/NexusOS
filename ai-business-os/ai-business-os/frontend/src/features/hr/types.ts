/** HR Employees — wire types matching backend 07.2+ contracts. */

export const EMPLOYEE_STATUSES = ["active", "on_leave", "terminated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_SORT_FIELDS = [
  "created_at",
  "employee_number",
  "last_name",
  "status",
] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/** Public employee row — salaryGrade appears only when backend authorizes it. */
export interface Employee {
  id: string;
  companyId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  workEmail: string | null;
  employeeNumber: string;
  department: string | null;
  managerId: string | null;
  hireDate: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  salaryGrade?: string | null;
}

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  sortBy?: EmployeeSortField;
  sortDesc?: boolean;
  search?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  managerId?: string;
}

export interface EmployeeCreatePayload {
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workEmail?: string | null;
  employeeNumber: string;
  department?: string | null;
  managerId?: string | null;
  hireDate?: string | null;
  salaryGrade?: string | null;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
}

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

export function employeeIncludesCompensation(
  employee: Employee,
): employee is Employee & { salaryGrade: string | null } {
  return Object.prototype.hasOwnProperty.call(employee, "salaryGrade");
}

export const LEAVE_TYPES = [
  "vacation",
  "sick",
  "personal",
  "parental",
  "unpaid",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  /** Present when the API can resolve the employee display name. */
  employeeFullName?: string | null;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
}

export interface LeaveRequestListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDesc?: boolean;
  employeeId?: string;
  approvalStatus?: ApprovalStatus;
  leaveType?: LeaveType;
}

export interface LeaveRequestCreatePayload {
  employeeId?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  /** Present when the API can resolve the employee display name. */
  employeeFullName?: string | null;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedAt?: string | null;
}

export interface AttendanceListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDesc?: boolean;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}
