/**
 * Settings page — company profile persistence (Part 08).
 * Calls GET /settings/company and PATCH /settings/company.
 * Also hosts SaaS billing + Stripe Connect status (separate domains).
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { request } from "@/api/client";
import { queryKeys } from "@/constants/queryKeys";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingSection } from "../components/BillingSection";
import { StripeConnectSection } from "../components/StripeConnectSection";

interface CompanySettings {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
}

type CompanySettingsUpdate = Partial<Omit<CompanySettings, "id" | "slug">>;

function fetchCompanySettings() {
  return request<CompanySettings>({ method: "GET", url: "/settings/company" });
}

function updateCompanySettings(payload: CompanySettingsUpdate) {
  return request<CompanySettings>({ method: "PATCH", url: "/settings/company", data: payload });
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.settings.company,
    queryFn: fetchCompanySettings,
  });

  const mutation = useMutation({
    mutationFn: (payload: CompanySettingsUpdate) => updateCompanySettings(payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.settings.company, updated);
      toast.success("Settings saved.");
    },
    onError: () => toast.error("Failed to save settings."),
  });

  const [form, setForm] = useState<CompanySettingsUpdate>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        industry: data.industry ?? "",
        website: data.website ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        timezone: data.timezone,
        currency: data.currency,
      });
      setDirty(false);
    }
  }, [data]);

  function handleChange(field: keyof CompanySettingsUpdate, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: CompanySettingsUpdate = {};
    for (const [k, v] of Object.entries(form)) {
      const key = k as keyof CompanySettingsUpdate;
      (payload as Record<string, unknown>)[key] = v === "" ? null : v;
    }
    await mutation.mutateAsync(payload);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <PageHeader title="Settings" description="Company profile and preferences." />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load settings" description={String(error)} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Company Name *">
            <Input
              value={String(form.name ?? "")}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Industry">
            <Input
              value={String(form.industry ?? "")}
              onChange={(e) => handleChange("industry", e.target.value)}
              placeholder="e.g. Technology"
            />
          </Field>
          <Field label="Website">
            <Input
              value={String(form.website ?? "")}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={String(form.phone ?? "")}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+1 555 000 0000"
            />
          </Field>
          <Field label="Billing Email">
            <Input
              type="email"
              value={String(form.email ?? "")}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="billing@company.com"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Timezone" className="flex-1">
              <Input
                value={String(form.timezone ?? "")}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="UTC"
              />
            </Field>
            <Field label="Currency (ISO)" className="flex-1">
              <Input
                value={String(form.currency ?? "")}
                onChange={(e) => handleChange("currency", e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
              />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!dirty || mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      )}

      <BillingSection />
      <StripeConnectSection />
    </div>
  );
}

function Field({
  label, children, className,
}: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
