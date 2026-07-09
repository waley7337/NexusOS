/** Strongly typed environment variables (Vite import.meta.env). */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  appEnv: import.meta.env.MODE as "development" | "production" | "test",
  isDev: import.meta.env.DEV,
} as const;
