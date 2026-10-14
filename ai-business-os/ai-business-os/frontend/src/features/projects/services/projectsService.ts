import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Project, ProjectCreatePayload, ProjectListParams, ProjectUpdatePayload,
  Task, TaskCreatePayload, TaskListParams, TaskUpdatePayload,
} from "../types";

// ---- Projects ----
const PROJECTS_BASE = "/projects";

function projectsQuery(p: ProjectListParams): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (p.page != null) q.page = p.page;
  if (p.pageSize != null) q.pageSize = p.pageSize;
  if (p.sortBy) q.sortBy = p.sortBy;
  if (p.sortDesc != null) q.sortDesc = p.sortDesc;
  if (p.status) q.status = p.status;
  if (p.search) q.search = p.search;
  return q;
}

export async function listProjects(
  params: ProjectListParams = {}, signal?: AbortSignal,
): Promise<Paginated<Project>> {
  return request<Paginated<Project>>({ method: "GET", url: PROJECTS_BASE, params: projectsQuery(params), signal });
}

export async function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  return request<Project>({ method: "GET", url: `${PROJECTS_BASE}/${id}`, signal });
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  return request<Project>({ method: "POST", url: PROJECTS_BASE, data: payload });
}

export async function updateProject(id: string, payload: ProjectUpdatePayload): Promise<Project> {
  return request<Project>({ method: "PATCH", url: `${PROJECTS_BASE}/${id}`, data: payload });
}

export async function deleteProject(id: string): Promise<void> {
  return request<void>({ method: "DELETE", url: `${PROJECTS_BASE}/${id}` });
}

// ---- Tasks ----
const TASKS_BASE = "/tasks";

function tasksQuery(p: TaskListParams): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (p.page != null) q.page = p.page;
  if (p.pageSize != null) q.pageSize = p.pageSize;
  if (p.sortBy) q.sortBy = p.sortBy;
  if (p.sortDesc != null) q.sortDesc = p.sortDesc;
  if (p.projectId) q.projectId = p.projectId;
  if (p.status) q.status = p.status;
  if (p.assigneeId) q.assigneeId = p.assigneeId;
  if (p.search) q.search = p.search;
  return q;
}

export async function listTasks(
  params: TaskListParams = {}, signal?: AbortSignal,
): Promise<Paginated<Task>> {
  return request<Paginated<Task>>({ method: "GET", url: TASKS_BASE, params: tasksQuery(params), signal });
}

export async function getTask(id: string, signal?: AbortSignal): Promise<Task> {
  return request<Task>({ method: "GET", url: `${TASKS_BASE}/${id}`, signal });
}

export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  return request<Task>({ method: "POST", url: TASKS_BASE, data: payload });
}

export async function updateTask(id: string, payload: TaskUpdatePayload): Promise<Task> {
  return request<Task>({ method: "PATCH", url: `${TASKS_BASE}/${id}`, data: payload });
}

export async function deleteTask(id: string): Promise<void> {
  return request<void>({ method: "DELETE", url: `${TASKS_BASE}/${id}` });
}
