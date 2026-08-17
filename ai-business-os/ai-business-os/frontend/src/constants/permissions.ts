/**
 * Permission catalog — mirrors backend/app/db/seed.py MODULES.
 * Typed union so typos are compile errors.
 */
const MODULES = {
  customers: ["read", "create", "update", "delete"],
  contacts: ["read", "create", "update", "delete"],
  leads: ["read", "create", "update", "delete"],
  deals: ["read", "create", "update", "delete"],
  projects: ["read", "create", "update", "delete", "manage"],
  tasks: ["read", "create", "update", "delete"],
  employees: [
    "read",
    "read_compensation",
    "read_self",
    "read_team",
    "create",
    "update",
    "delete",
  ],
  finance: ["view", "manage"],
  invoices: ["read", "create", "update", "delete", "send"],
  inventory: ["read", "manage"],
  documents: ["read", "upload", "delete"],
  reports: ["view", "export", "schedule"],
  workflows: ["read", "manage"],
  ai: ["use"],
  settings: ["view", "manage"],
  users: ["read", "invite", "manage"],
  roles: ["read", "manage"],
  audit: ["view"],
} as const;

type ModuleKey = keyof typeof MODULES;
type ActionFor<M extends ModuleKey> = (typeof MODULES)[M][number];
export type Permission = {
  [M in ModuleKey]: `${M}.${ActionFor<M>}`;
}[ModuleKey];

export const ALL_PERMISSIONS = Object.entries(MODULES).flatMap(([module, actions]) =>
  actions.map((action) => `${module}.${action}`),
) as Permission[];

export function hasPermission(
  permissions: readonly string[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}

/** True when the caller holds at least one of the listed permissions. */
export function hasAnyPermission(
  permissions: readonly string[],
  required: readonly Permission[],
): boolean {
  return required.some((perm) => permissions.includes(perm));
}

/** Permissions that grant entry to the operational HR workspace (07.2). */
export const HR_WORKSPACE_PERMISSIONS = [
  "employees.read",
  "employees.read_self",
  "employees.read_team",
] as const satisfies readonly Permission[];
