import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveEmployee,
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "../services/employeesService";
import type {
  Employee,
  EmployeeCreatePayload,
  EmployeeListParams,
  EmployeeUpdatePayload,
} from "../types";

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: queryKeys.hr.employees.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listEmployees(params, signal),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: queryKeys.hr.employees.detail(id ?? ""),
    queryFn: ({ signal }) => getEmployee(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeCreatePayload) => createEmployee(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.options() });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmployeeUpdatePayload }) =>
      updateEmployee(id, payload),
    onSuccess: (employee: Employee) => {
      queryClient.setQueryData(queryKeys.hr.employees.detail(employee.id), employee);
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.options() });
    },
  });
}

export function useArchiveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveEmployee(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.hr.employees.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hr.employees.options() });
    },
  });
}
