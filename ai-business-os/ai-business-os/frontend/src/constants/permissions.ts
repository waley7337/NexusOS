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
  hr: ["read", "manage"],
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
