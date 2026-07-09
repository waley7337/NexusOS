/**
 * Design System — living style guide (/design).
 * Renders every token and component from Part 4 so reviewers can see the
 * system, not just read about it. This page is also the visual regression
 * baseline: if something looks wrong here, it's wrong everywhere.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fadeInUp, staggerChildren } from "@/lib/motion";

/* ------------------------------ helpers ------------------------------- */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName, hex }: { name: string; varName: string; hex: string }) {
  return (
    <div className="space-y-1.5">
      <div className="h-14 rounded-card border shadow-sm" style={{ background: `hsl(var(${varName}))` }} />
      <p className="text-sm font-medium">{name}</p>
      <p className="font-mono text-xs text-muted-foreground">{hex}</p>
    </div>
  );
}

/* --------------------------- table demo data --------------------------- */
interface DemoCustomer {
  name: string;
  contact: string;
  status: "active" | "lead" | "churned";
  country: string;
  value: number;
}

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { name: "Acme Ltd.", contact: "Sarah Kim", status: "active", country: "Austria", value: 48200 },
  { name: "Globex Corp.", contact: "Marco Rossi", status: "lead", country: "Italy", value: 12400 },
  { name: "Northwind GmbH", contact: "Lena Weber", status: "active", country: "Germany", value: 87100 },
  { name: "Initech", contact: "Peter Gibbons", status: "churned", country: "USA", value: 0 },
  { name: "Umbrella SA", contact: "Alice Moreau", status: "active", country: "France", value: 31900 },
  { name: "Stark Industries", contact: "Pepper Potts", status: "lead", country: "USA", value: 250000 },
  { name: "Wayne Enterprises", contact: "Lucius Fox", status: "active", country: "USA", value: 190000 },
  { name: "Hooli", contact: "Jared Dunn", status: "lead", country: "USA", value: 5600 },
  { name: "Pied Piper", contact: "Richard Hendricks", status: "active", country: "USA", value: 44000 },
  { name: "Soylent Corp.", contact: "Frank Thorn", status: "churned", country: "UK", value: 800 },
  { name: "Vandelay Industries", contact: "Art Vandelay", status: "lead", country: "USA", value: 7300 },
  { name: "Wonka GmbH", contact: "Charlie Bucket", status: "active", country: "Germany", value: 66200 },
];

const STATUS_BADGE = { active: "success", lead: "info", churned: "danger" } as const;

const demoColumns: ColumnDef<DemoCustomer, unknown>[] = [
  { accessorKey: "name", header: "Customer" },
  { accessorKey: "contact", header: "Contact" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const s = getValue() as DemoCustomer["status"];
      return <Badge variant={STATUS_BADGE[s]}>{s}</Badge>;
    },
  },
  { accessorKey: "country", header: "Country" },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">${(getValue() as number).toLocaleString()}</span>
    ),
  },
];

/* -------------------------------- page --------------------------------- */
export function DesignSystemPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="max-w-4xl space-y-12 pb-16">
      <motion.div variants={fadeInUp}>
        <Breadcrumb items={[{ label: "NexusOS", to: "/" }, { label: "Design system" }]} className="mb-3" />
        <h1 className="text-display">Design system</h1>
        <p className="mt-2 max-w-xl text-body-lg text-muted-foreground">
          The single source of truth for every screen in NexusOS. Tokens first, components second —
          nothing on this page uses a value that isn't a token.
        </p>
      </motion.div>

      {/* ------------------------------ Colors ----------------------------- */}
      <Section id="colors" title="Color">
        <p className="text-caption">Brand & semantic</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Swatch name="Primary" varName="--primary" hex="#2563EB" />
          <Swatch name="Success" varName="--success" hex="#16A34A" />
          <Swatch name="Warning" varName="--warning" hex="#F59E0B" />
          <Swatch name="Danger" varName="--destructive" hex="#DC2626" />
          <Swatch name="Info" varName="--info" hex="#0891B2" />
        </div>
        <p className="text-caption">Neutrals (light)</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Swatch name="Background" varName="--background" hex="#F8FAFC" />
          <Swatch name="Surface" varName="--card" hex="#FFFFFF" />
          <Swatch name="Border" varName="--border" hex="#E2E8F0" />
          <Swatch name="Muted" varName="--muted" hex="#F1F5F9" />
          <Swatch name="Text" varName="--foreground" hex="#0F172A" />
        </div>
      </Section>

      {/* ---------------------------- Typography --------------------------- */}
      <Section id="type" title="Typography">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-display">Display / 36 / 600</p>
            <p className="text-h1">Heading 1 / 24 / 600</p>
            <p className="text-h2">Heading 2 / 20 / 600</p>
            <p className="text-h3">Heading 3 / 18 / 600</p>
            <p className="text-h4">Heading 4 / 16 / 600</p>
            <p className="text-body-lg">Body large / 16 / 400 — for lead paragraphs and reading surfaces.</p>
            <p className="text-body">Body / 14 / 400 — the default for interface text, forms, and tables.</p>
            <p className="text-small text-muted-foreground">Small / 12 / 400 — metadata and timestamps.</p>
            <p className="text-caption">Caption / 12 / 500 / uppercase</p>
            <p className="font-mono text-xs">Mono — SKU-2941 · $12,400.00 · a4f9c2</p>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------ Surfaces & elevation ---------------------- */}
      <Section id="elevation" title="Radius & elevation">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-btn border bg-card p-4 shadow-sm text-sm">Button · 10px · shadow-sm</div>
          <div className="rounded-card border bg-card p-4 shadow-md text-sm">Card · 12px · shadow-md</div>
          <div className="rounded-dialog border bg-card p-4 shadow-modal text-sm">Dialog · 16px · shadow-modal</div>
        </div>
      </Section>

      {/* ------------------------------ Buttons ---------------------------- */}
      <Section id="buttons" title="Buttons">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Delete customer</Button>
              <Button variant="success">Approve</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Add"><Plus /></Button>
              <Button loading>Saving…</Button>
              <Button disabled>Disabled</Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------------- Forms ------------------------------ */}
      <Section id="forms" title="Forms">
        <Card>
          <CardContent className="max-w-lg space-y-4">
            <FieldRow>
              <Field label="First name" required>
                <Input placeholder="Sarah" autoComplete="given-name" />
              </Field>
              <Field label="Last name" required>
                <Input placeholder="Kim" autoComplete="family-name" />
              </Field>
            </FieldRow>
            <Field label="Work email" required error="Enter a valid email address">
              <Input type="email" defaultValue="sarah@acme" />
            </Field>
            <Field label="Country" helper="Used for tax and currency defaults.">
              <Select defaultValue="at">
                <option value="at">Austria</option>
                <option value="de">Germany</option>
                <option value="us">United States</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea placeholder="Anything the team should know…" />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-terms" />
              <Label htmlFor="ds-terms">Send a welcome email</Label>
            </div>
            <RadioGroup defaultValue="monthly" aria-label="Billing period" className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="monthly" id="ds-m" />
                <Label htmlFor="ds-m">Monthly</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yearly" id="ds-y" />
                <Label htmlFor="ds-y">Yearly</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Switch id="ds-auto" defaultChecked />
              <Label htmlFor="ds-auto">Autosave drafts</Label>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ----------------------------- Feedback ----------------------------- */}
      <Section id="feedback" title="Feedback">
        <div className="grid gap-3">
          <Alert variant="info" title="Heads up">Invoices sync from Stripe every 15 minutes.</Alert>
          <Alert variant="success" title="Import complete">312 customers were added.</Alert>
          <Alert variant="warning" title="Trial ends in 3 days">Add a payment method to keep your workspace.</Alert>
          <Alert variant="danger" title="Payment failed">We couldn't charge the card on file. Update billing to retry.</Alert>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Customer created.")}>Success toast</Button>
          <Button variant="outline" size="sm" onClick={() => toast.warning("Inventory for Product X is low.")}>Warning toast</Button>
          <Button variant="outline" size="sm" onClick={() => toast.error("We couldn't save your changes.")}>Error toast</Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("3 invoices are due this week.")}>Info toast</Button>
        </div>
        <Card>
          <CardHeader><CardTitle>Loading — skeletons & progress only</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Progress value={64} />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Customers you add will show up here with their deals and invoices."
            actionLabel="Create customer"
            onAction={() => toast.info("This lives in the CRM module.")}
          />
          <ErrorState onRetry={() => toast.info("Retrying…")} />
        </div>
      </Section>

      {/* ----------------------------- Overlays ----------------------------- */}
      <Section id="overlays" title="Overlays">
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete invoice…</Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete invoice #1034?"
            description="The invoice moves to the archive for 30 days, then it's gone for good."
            confirmLabel="Delete invoice"
            destructive
            onConfirm={() => {
              setConfirmOpen(false);
              toast.success("Invoice deleted.");
            }}
          />
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Open customer drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader title="Acme Ltd." description="Customer since March 2024" />
              <DrawerBody className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name="Sarah Kim" size="lg" />
                  <div>
                    <p className="text-sm font-medium">Sarah Kim</p>
                    <p className="text-xs text-muted-foreground">Primary contact · sarah@acme.com</p>
                  </div>
                </div>
                <Field label="Owner">
                  <Select defaultValue="waley">
                    <option value="waley">Waley Elnagdi</option>
                    <option value="omar">Omar Farouk</option>
                  </Select>
                </Field>
                <Button className="w-full">Save changes</Button>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </div>
      </Section>

      {/* ---------------------------- Navigation ---------------------------- */}
      <Section id="navigation" title="Navigation">
        <Card>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="text-sm text-muted-foreground">
                Everything about this record at a glance.
              </TabsContent>
              <TabsContent value="activity" className="text-sm text-muted-foreground">
                The timeline of every change, by everyone.
              </TabsContent>
              <TabsContent value="invoices" className="text-sm text-muted-foreground">
                Billing history for this customer.
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------------- Table ------------------------------ */}
      <Section id="table" title="Data table">
        <p className="text-sm text-muted-foreground">
          Sorting, search, pagination, bulk selection, column visibility, and CSV export —
          the standard list surface for every module.
        </p>
        <DataTable
          columns={demoColumns}
          data={DEMO_CUSTOMERS}
          selectable
          exportFileName="customers"
          searchPlaceholder="Search customers…"
          pageSize={6}
        />
      </Section>
    </motion.div>
  );
}
