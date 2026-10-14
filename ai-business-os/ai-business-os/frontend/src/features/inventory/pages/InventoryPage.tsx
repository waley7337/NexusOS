/**
 * Inventory workspace — products and stock management (Part 08.3).
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Boxes, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Drawer, DrawerBody, DrawerContent, DrawerHeader,
} from "@/components/ui/drawer";
import { useDebounce } from "@/hooks/useDebounce";
import {
  type Product, type ProductCreatePayload, type StockAdjustPayload,
} from "../types";
import {
  useAdjustStock, useCreateProduct, useDeleteProduct,
  useProducts, useStock, useUpdateProduct, useWarehouses,
} from "../hooks/useInventory";

const PAGE_SIZE = 20;

interface ProductFormProps {
  initial?: Partial<Product>;
  onSubmit: (values: ProductCreatePayload) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function ProductForm({ initial, onSubmit, onCancel, loading }: ProductFormProps) {
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [unitPrice, setUnitPrice] = useState(String(initial?.unitPrice ?? ""));
  const [unit, setUnit] = useState(initial?.unit ?? "unit");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      sku: sku.trim(),
      name: name.trim(),
      description: description || null,
      category: category || null,
      unitPrice: Number(unitPrice),
      unit: unit || "unit",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">SKU *</label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PROD-001" required />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Unit</label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit, kg, box…" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Name *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Category</label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional category" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Unit price *</label>
        <Input
          type="number" min="0" step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="rounded-control border border-line-soft bg-surface-0 px-3 py-2 text-sm resize-none h-20 focus:outline-hidden focus:ring-1 focus:ring-ring"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !sku.trim() || !name.trim()}>
          {loading ? "Saving…" : (initial?.id ? "Update" : "Create")}
        </Button>
      </div>
    </form>
  );
}

interface AdjustStockFormProps {
  onSubmit: (payload: StockAdjustPayload) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function AdjustStockForm({ onSubmit, onCancel, loading }: AdjustStockFormProps) {
  const { data: productsData } = useProducts({ pageSize: 100 });
  const { data: warehousesData } = useWarehouses();

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !warehouseId || !delta) return;
    await onSubmit({ productId, warehouseId, delta: Number(delta), reason: reason || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Product *</label>
        <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="">Select product…</option>
          {productsData?.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Warehouse *</label>
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="">Select warehouse…</option>
          {warehousesData?.items.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Quantity change (+ or −) *</label>
        <Input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+10 or -5"
          required
        />
        <p className="text-small text-muted-foreground">Positive to receive stock, negative to issue it.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Reason</label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !productId || !warehouseId || !delta}>
          {loading ? "Adjusting…" : "Adjust Stock"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") ?? "products") as "products" | "stock";
  const page = Number(searchParams.get("page") ?? 1);
  const rawSearch = searchParams.get("search") ?? "";
  const debouncedSearch = useDebounce(rawSearch, 350);

  const productsParams = { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined };
  const stockParams = { page, pageSize: PAGE_SIZE };

  const productsQuery = useProducts(productsParams);
  const stockQuery = useStock(stockParams);
  const createMutation = useCreateProduct();
  const deleteMutation = useDeleteProduct();
  const adjustMutation = useAdjustStock();

  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "adjust" | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const updateMutation = useUpdateProduct(editTarget?.id ?? "");

  function setTab(t: string) {
    setSearchParams((prev) => { prev.set("tab", t); prev.set("page", "1"); return prev; });
  }
  function setPage(p: number) {
    setSearchParams((prev) => { prev.set("page", String(p)); return prev; });
  }
  function setSearch(s: string) {
    setSearchParams((prev) => { prev.set("search", s); prev.set("page", "1"); return prev; });
  }

  async function handleCreate(payload: ProductCreatePayload) {
    await createMutation.mutateAsync(payload);
    toast.success("Product created."); setDrawerMode(null);
  }
  async function handleUpdate(payload: ProductCreatePayload) {
    if (!editTarget) return;
    await updateMutation.mutateAsync(payload);
    toast.success("Product updated."); setDrawerMode(null); setEditTarget(null);
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    toast.success("Product deleted."); setDeleteTarget(null);
  }
  async function handleAdjust(payload: StockAdjustPayload) {
    await adjustMutation.mutateAsync(payload);
    toast.success("Stock adjusted."); setDrawerMode(null);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Inventory"
        description="Products, warehouses, and stock levels."
        actions={
          tab === "products" ? (
            <Button onClick={() => setDrawerMode("create")}>
              <Plus className="h-4 w-4 mr-1" /> New Product
            </Button>
          ) : (
            <Button onClick={() => setDrawerMode("adjust")}>
              <Plus className="h-4 w-4 mr-1" /> Adjust Stock
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line-soft">
        {(["products", "stock"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "products" ? "Products" : "Stock Levels"}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === "products" && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search products…" value={rawSearch} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : productsQuery.isError ? (
            <ErrorState title="Failed to load products" description="" />
          ) : !productsQuery.data?.items.length ? (
            <EmptyState icon={Boxes} title="No products yet" description="Create your first product." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-muted-foreground">
                      <th className="pb-2 text-left font-medium">SKU</th>
                      <th className="pb-2 text-left font-medium">Name</th>
                      <th className="pb-2 text-left font-medium">Category</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsQuery.data.items.map((product) => (
                      <tr key={product.id} className="border-b border-line-soft/50 hover:bg-surface-1">
                        <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{product.sku}</td>
                        <td className="py-2.5 pr-4 font-medium">{product.name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{product.category ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-right">
                          {Number(product.unitPrice).toFixed(2)} {product.currency}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setEditTarget(product); setDrawerMode("edit"); }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(product)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={productsQuery.data.meta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {/* Stock tab */}
      {tab === "stock" && (
        <>
          {stockQuery.isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : stockQuery.isError ? (
            <ErrorState title="Failed to load stock levels" description="" />
          ) : !stockQuery.data?.items.length ? (
            <EmptyState icon={Boxes} title="No stock records" description='Use "Adjust Stock" to record initial quantities.' />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Product</th>
                      <th className="pb-2 text-left font-medium">Warehouse</th>
                      <th className="pb-2 text-right font-medium">Quantity</th>
                      <th className="pb-2 text-right font-medium">Min Qty</th>
                      <th className="pb-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockQuery.data.items.map((s) => {
                      const isLow = s.quantity <= s.minimumQuantity;
                      return (
                        <tr key={s.id} className="border-b border-line-soft/50 hover:bg-surface-1">
                          <td className="py-2.5 pr-4">{s.product?.name ?? s.productId}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{s.warehouse?.name ?? s.warehouseId}</td>
                          <td className="py-2.5 pr-4 text-right font-mono">{s.quantity}</td>
                          <td className="py-2.5 pr-4 text-right font-mono text-muted-foreground">{s.minimumQuantity}</td>
                          <td className="py-2.5 text-right">
                            <span className={`text-xs font-medium ${isLow ? "text-destructive" : "text-green-600"}`}>
                              {isLow ? "Low stock" : "OK"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={stockQuery.data.meta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {/* Product create/edit drawer */}
      <Drawer open={drawerMode === "create" || drawerMode === "edit"} onOpenChange={(o) => { if (!o) { setDrawerMode(null); setEditTarget(null); } }}>
        <DrawerContent>
          <DrawerHeader title={drawerMode === "edit" ? "Edit Product" : "New Product"} />
          <DrawerBody>
            <ProductForm
              initial={editTarget ?? undefined}
              onSubmit={drawerMode === "edit" ? handleUpdate : handleCreate}
              onCancel={() => { setDrawerMode(null); setEditTarget(null); }}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Stock adjust drawer */}
      <Drawer open={drawerMode === "adjust"} onOpenChange={(o) => { if (!o) setDrawerMode(null); }}>
        <DrawerContent>
          <DrawerHeader title="Adjust Stock" />
          <DrawerBody>
            <AdjustStockForm
              onSubmit={handleAdjust}
              onCancel={() => setDrawerMode(null)}
              loading={adjustMutation.isPending}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete product?"
        description={`"${deleteTarget?.name ?? ""}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
