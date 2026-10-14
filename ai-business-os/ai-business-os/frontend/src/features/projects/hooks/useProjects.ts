import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import type { ProjectListParams, ProjectCreatePayload, ProjectUpdatePayload, TaskListParams, TaskCreatePayload, TaskUpdatePayload } from "../types";
import {
  createProject, createTask, deleteProject, deleteTask,
  getProject, getTask, listProjects, listTasks,
  updateProject, updateTask,
} from "../services/projectsService";

// ---- Projects ----

export function useProjects(params: ProjectListParams = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listProjects(params, signal),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: ({ signal }) => getProject(id, signal),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreatePayload) => createProject(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectUpdatePayload) => updateProject(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}

// ---- Tasks ----

export function useTasks(params: TaskListParams = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listTasks(params, signal),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: ({ signal }) => getTask(id, signal),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => createTask(payload),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      if (created.projectId) {
        void qc.invalidateQueries({ queryKey: queryKeys.tasks.list({ projectId: created.projectId }) });
      }
    },
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskUpdatePayload) => updateTask(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tasks.detail(id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.tasks.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
    },
  });
}
