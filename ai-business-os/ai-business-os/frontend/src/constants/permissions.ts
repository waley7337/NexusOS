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

/** Demo role → permission sets until Part 6 GET /auth/me ships. */
export const DEMO_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [
    "customers.read", "customers.create", "customers.update", "customers.delete",
    "contacts.read", "contacts.create", "contacts.update", "contacts.delete",
    "leads.read", "leads.create", "leads.update", "leads.delete",
    "deals.read", "deals.create", "deals.update", "deals.delete",
    "projects.read", "projects.create", "projects.update", "projects.delete", "projects.manage",
    "tasks.read", "tasks.create", "tasks.update", "tasks.delete",
    "invoices.read", "finance.view", "inventory.read",
    "documents.read", "documents.upload", "documents.delete",
    "reports.view", "reports.export", "ai.use", "users.read",
  ],
  employee: [
    "customers.read", "contacts.read", "leads.read",
    "projects.read", "tasks.read", "tasks.create", "tasks.update", "tasks.delete",
    "documents.read", "documents.upload", "ai.use",
  ],
  viewer: ["customers.read", "projects.read", "tasks.read", "reports.view"],
};

export function permissionsForRole(role: string): readonly Permission[] {
  const key = role.toLowerCase();
  return DEMO_ROLE_PERMISSIONS[key] ?? DEMO_ROLE_PERMISSIONS.viewer;
}

export function hasPermission(
  permissions: readonly string[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}
