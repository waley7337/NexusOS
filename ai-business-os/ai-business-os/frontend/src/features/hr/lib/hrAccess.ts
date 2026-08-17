import { usePermission } from "@/hooks/usePermission";
import type { Employee } from "../types";

export interface HrAccessProfile {
  canDirectory: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canFilterByManager: boolean;
  isManagerView: boolean;
  isSelfOnlyView: boolean;
}

/** Derives HR UX mode from flattened permissions (never role names). */
export function useHrAccess(): HrAccessProfile {
  const canDirectory = usePermission("employees.read");
  const canReadTeam = usePermission("employees.read_team");
  const canReadSelf = usePermission("employees.read_self");

  return {
    canDirectory,
    canCreate: usePermission("employees.create"),
    canUpdate: usePermission("employees.update"),
    canArchive: usePermission("employees.delete"),
    canFilterByManager: canDirectory,
    isManagerView: !canDirectory && canReadTeam,
    isSelfOnlyView: !canDirectory && !canReadTeam && canReadSelf,
  };
}

export function hrPageCopy(access: HrAccessProfile): { title: string; description: string } {
  if (access.canDirectory) {
    return {
      title: "Employees",
      description: "People records and employment identity for your organization.",
    };
  }
  if (access.isManagerView) {
    return {
      title: "HR",
      description: "Your employment record and direct reports.",
    };
  }
  return {
    title: "My employment",
    description: "Your employment record in this organization.",
  };
}

export function splitManagerList(
  items: Employee[],
  currentUserId: string | null,
  callerEmployeeId: string | null,
): { self: Employee[]; team: Employee[] } {
  const self = items.filter((row) => row.userId === currentUserId);
  const team =
    callerEmployeeId == null
      ? []
      : items.filter(
          (row) => row.managerId === callerEmployeeId && row.userId !== currentUserId,
        );
  return { self, team };
}
