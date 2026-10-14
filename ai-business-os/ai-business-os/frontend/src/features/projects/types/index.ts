/** Projects + Tasks domain types — wire values must match backend enums. */

export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "archived";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "planned", "active", "on_hold", "completed", "archived",
];

export const TASK_STATUSES: TaskStatus[] = [
  "backlog", "todo", "in_progress", "in_review", "done", "canceled",
];

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  ownerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  progress: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  companyId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  reporterId: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDesc?: boolean;
  status?: ProjectStatus;
  search?: string;
}

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDesc?: boolean;
  projectId?: string;
  status?: TaskStatus;
  assigneeId?: string;
  search?: string;
}

export interface ProjectCreatePayload {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: TaskPriority;
  ownerId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export type ProjectUpdatePayload = Partial<ProjectCreatePayload>;

export interface TaskCreatePayload {
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
}

export type TaskUpdatePayload = Partial<Omit<TaskCreatePayload, "projectId">>;
