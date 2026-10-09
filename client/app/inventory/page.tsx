"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  DataTableSection,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  Textarea,
} from "@/components/ui";
import { getBranches } from "@/lib/api";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import {
  inventoryRequest,
  type InventoryMovement,
  type InventoryOrder,
  type InventoryProduct,
  type InventoryRow,
} from "@/lib/inventoryApi";

type Tab =
  | "overview"
  | "products"
  | "movements"
  | "transfers"
  | "orders"
  | "suppliers"
  | "reports";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "movements", label: "Stock Movements" },
  { id: "transfers", label: "Transfers" },
  { id: "orders", label: "Orders" },
  { id: "suppliers", label: "Suppliers" },
  { id: "reports", label: "Reports" },
];
const CATEGORIES = [
  "UNIFORM",
  "GLOVES",
  "BELTS",
  "EQUIPMENT",
  "MERCHANDISE",
  "OTHER",
];
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cash = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nameOf = (value?: { name: string } | string | null) =>
  typeof value === "string" ? value : value?.name || "—";

export default function InventoryPage() {
  const canView = useCan(PERMISSIONS.INVENTORY_VIEW);
  const canCreate = useCan(PERMISSIONS.INVENTORY_CREATE);
  const canUpdate = useCan(PERMISSIONS.INVENTORY_UPDATE);
  const canPurchase = useCan(PERMISSIONS.INVENTORY_PURCHASE);
  const canAdjust = useCan(PERMISSIONS.INVENTORY_ADJUST);
  const canDamage = useCan(PERMISSIONS.INVENTORY_DAMAGE);
  const canTransfer = useCan(PERMISSIONS.INVENTORY_TRANSFER);
  const canSale = useCan(PERMISSIONS.INVENTORY_SALE);
  const canReturn = useCan(PERMISSIONS.INVENTORY_RETURN);
  const canManage = useCan(PERMISSIONS.INVENTORY_MANAGE);
  const canReport = useCan(PERMISSIONS.INVENTORY_REPORT);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<InventoryOrder[]>([]);
  const [transfers, setTransfers] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<
    {
      _id: string;
      name: string;
      status: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
    }[]
  >([]);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(
    null,
  );
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [productModal, setProductModal] = useState(false);
  const [movementModal, setMovementModal] = useState<
    "PURCHASE" | "ADJUSTMENT" | "DAMAGE" | "TRANSFER" | "ORDER" | null
  >(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [thresholdTarget, setThresholdTarget] = useState<{
    product: InventoryProduct;
    row: InventoryRow;
  } | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [cancelTarget, setCancelTarget] = useState<InventoryOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [productForm, setProductForm] = useState({
    id: "",
    name: "",
    sku: "",
    category: "UNIFORM",
    status: "ACTIVE",
    sellingPrice: "",
    description: "",
    imageUrl: "",
    supplier: "",
    isPublished: false,
  });
  const [movementForm, setMovementForm] = useState({
    productId: "",
    branchId: "",
    sourceBranch: "",
    destinationBranch: "",
    quantity: "",
    change: "",
    purchasePrice: "",
    minimumStock: "",
    studentId: "",
    fulfillment: "PICKUP",
    reason: "",
    supplier: "",
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    getBranches()
      .then((result) => {
        if (!cancelled)
          setBranches(
            result.branches.filter((branch) => branch.isActive !== false),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const branchQuery = branchId
      ? `?branch=${encodeURIComponent(branchId)}`
      : "";
    try {
      const [
        summary,
        productResult,
        movementResult,
        orderResult,
        transferResult,
        supplierResult,
        reportResult,
      ] = await Promise.all([
        inventoryRequest<{
          summary: Record<string, unknown>;
          branchSummary: unknown[];
          recentMovements: InventoryMovement[];
          recentSales: InventoryMovement[];
        }>(`/dashboard${branchQuery}`),
        inventoryRequest<{ products: InventoryProduct[] }>(
          `/products?${branchQuery.replace(/^\?/, "")}${branchQuery ? "&" : ""}limit=200`,
        ),
        inventoryRequest<{ movements: InventoryMovement[] }>(
          `/movements${branchQuery}${branchQuery ? "&" : "?"}limit=100`,
        ),
        inventoryRequest<{ orders: InventoryOrder[] }>(
          `/orders${branchQuery}${branchQuery ? "&" : "?"}limit=100`,
        ),
        inventoryRequest<{ transfers: Record<string, unknown>[] }>(
          `/transfers${branchQuery}`,
        ),
        inventoryRequest<{ suppliers: typeof suppliers }>(
          "/suppliers?limit=200",
        ),
        canReport
          ? inventoryRequest<Record<string, unknown>>(`/reports${branchQuery}`)
          : Promise.resolve(null),
      ]);
      setDashboard(summary as unknown as Record<string, unknown>);
      setProducts(productResult.products);
      setMovements(movementResult.movements);
      setOrders(orderResult.orders);
      setTransfers(transferResult.transfers);
      setSuppliers(supplierResult.suppliers);
      setReports(reportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [branchId, canReport, canView]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, reload]);
  const summary = (dashboard?.summary || {}) as Record<string, number>;
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          `${product.name} ${product.sku}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!categoryFilter || product.category === categoryFilter) &&
          (!statusFilter || product.status === statusFilter) &&
          (!stockFilter ||
            product.inventory?.some((row) => row.stockState === stockFilter) ||
            (stockFilter === "NOT_STOCKED" && !product.inventory?.length)),
      ),
    [products, search, categoryFilter, statusFilter, stockFilter],
  );
  const openProduct = (product?: InventoryProduct) => {
    setProductForm(
      product
        ? {
            id: product._id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            status: product.status,
            sellingPrice: String(product.sellingPrice),
            description: product.description || "",
            imageUrl: product.imageUrl || "",
            supplier:
              typeof product.supplier === "object" && product.supplier
                ? product.supplier._id
                : "",
            isPublished: product.isPublished,
          }
        : {
            id: "",
            name: "",
            sku: "",
            category: "UNIFORM",
            status: "ACTIVE",
            sellingPrice: "",
            description: "",
            imageUrl: "",
            supplier: "",
            isPublished: false,
          },
    );
    setProductModal(true);
  };
  const openMovement = (
    kind: NonNullable<typeof movementModal>,
    product?: InventoryProduct,
  ) => {
    const branch = branchId || (branches.length === 1 ? branches[0]._id : "");
    setMovementForm({
      productId: product?._id || "",
      branchId: branch,
      sourceBranch: branch,
      destinationBranch: "",
      quantity: "",
      change: "",
      purchasePrice: "",
      minimumStock: "",
      studentId: "",
      fulfillment: "PICKUP",
      reason: "",
      supplier: "",
    });
    setMovementModal(kind);
  };
  const refresh = () => setReload((count) => count + 1);
  const saveProduct = async () => {
    if (
      !productForm.name.trim() ||
      !productForm.sku.trim() ||
      productForm.sellingPrice === ""
    ) {
      toast.error("Name, SKU, and selling price are required.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: productForm.name,
        sku: productForm.sku,
        category: productForm.category,
        status: productForm.status,
        sellingPrice: Number(productForm.sellingPrice),
        description: productForm.description,
        imageUrl: productForm.imageUrl,
        supplier: productForm.supplier || null,
        isPublished: productForm.isPublished,
      };
      await inventoryRequest(
        productForm.id ? `/products/${productForm.id}` : "/products",
        productForm.id ? "PUT" : "POST",
        body,
      );
      toast.success(productForm.id ? "Product updated." : "Product created.");
      setProductModal(false);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to save product.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submitMovement = async () => {
    if (!movementModal) return;
    if (!movementForm.reason.trim()) {
      toast.error("A reason is required for every inventory operation.");
      return;
    }
    setBusy(true);
    try {
      const key = newKey();
      if (movementModal === "TRANSFER")
        await inventoryRequest("/transfers", "POST", {
          productId: movementForm.productId,
          sourceBranch: movementForm.sourceBranch,
          destinationBranch: movementForm.destinationBranch,
          quantity: Number(movementForm.quantity),
          reason: movementForm.reason,
          idempotencyKey: key,
        });
      else if (movementModal === "ORDER") {
        const result = await inventoryRequest<{
          invoice?: { invoiceNumber: string };
        }>("/orders", "POST", {
          studentId: movementForm.studentId,
          branchId: movementForm.branchId,
          items: [
            {
              productId: movementForm.productId,
              quantity: Number(movementForm.quantity),
            },
          ],
          fulfillment: movementForm.fulfillment,
          idempotencyKey: key,
        });
        toast.success(
          `Order created. Collect payment against ${result.invoice?.invoiceNumber || "the linked invoice"} in Fees & Payments.`,
        );
        setMovementModal(null);
        refresh();
        return;
      } else {
        const path =
          movementModal === "PURCHASE"
            ? "/purchases"
            : movementModal === "DAMAGE"
              ? "/damage"
              : "/adjustments";
        await inventoryRequest(path, "POST", {
          productId: movementForm.productId,
          branchId: movementForm.branchId,
          quantity: Number(movementForm.quantity),
          change: Number(movementForm.change),
          purchasePrice:
            movementForm.purchasePrice === ""
              ? undefined
              : Number(movementForm.purchasePrice),
          minimumStock:
            movementForm.minimumStock === ""
              ? undefined
              : Number(movementForm.minimumStock),
          supplier: movementForm.supplier || undefined,
          reason: movementForm.reason,
          idempotencyKey: key,
        });
      }
      toast.success(
        movementModal === "TRANSFER"
          ? "Branch transfer completed."
          : "Stock movement saved.",
      );
      setMovementModal(null);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Inventory operation failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setBusy(true);
    try {
      await inventoryRequest("/suppliers", "POST", supplierForm);
      toast.success("Supplier added.");
      setSupplierModal(false);
      setSupplierForm({
        name: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to save supplier.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openCancelOrder = (order: InventoryOrder) => {
    setCancelReason("");
    setCancelTarget(order);
  };
  const submitCancelOrder = async () => {
    if (!cancelTarget || !cancelReason.trim()) {
      toast.error("A cancellation reason is required.");
      return;
    }
    setBusy(true);
    try {
      await inventoryRequest(`/orders/${cancelTarget._id}/cancel`, "POST", {
        reason: cancelReason,
      });
      toast.success("Order cancelled and reserved stock released.");
      setCancelTarget(null);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to cancel order.",
      );
    } finally {
      setBusy(false);
    }
  };
  const editMinimumStock = (product: InventoryProduct, row: InventoryRow) => {
    setThresholdValue(String(row.minimumStock));
    setThresholdTarget({ product, row });
  };
  const saveMinimumStock = async () => {
    if (!thresholdTarget) return;
    const branch = thresholdTarget.row.branch;
    const branchId = typeof branch === "string" ? branch : branch._id;
    const minimumStock = Number(thresholdValue);
    if (!Number.isSafeInteger(minimumStock) || minimumStock < 0) {
      toast.error("Enter a whole number of zero or greater.");
      return;
    }
    setBusy(true);
    try {
      await inventoryRequest(
        `/stock/${thresholdTarget.product._id}/${branchId}`,
        "PUT",
        { minimumStock },
      );
      toast.success("Low-stock threshold updated.");
      setThresholdTarget(null);
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to update the threshold.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canView)
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Inventory"
          description="Your role does not include inventory access."
        />
      </div>
    );
  if (loading)
    return (
      <div className="df-page flex min-h-64 items-center justify-center">
        <LoadingSpinner text="Loading inventory..." />
      </div>
    );
  if (error && !dashboard)
    return (
      <div className="df-page">
        <ErrorState
          message={error}
          action={<Button onClick={refresh}>Try again</Button>}
        />
      </div>
    );

  return (
    <div className="df-page space-y-5">
      <PageHeader
        eyebrow="Academy Operations"
        title="Inventory & Merchandise"
        description="Manage products, branch stock, movements, orders, and stock value."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<RefreshCw size={16} />}
              onClick={refresh}
            >
              Refresh
            </Button>
            {canCreate && (
              <Button
                leftIcon={<Plus size={16} />}
                onClick={() => openProduct()}
              >
                Add product
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line) bg-(--card) p-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === item.id ? "bg-(--accent) text-white" : "text-(--ink-muted) hover:bg-(--hover-bg)"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Select
          aria-label="Filter branch"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          className="min-w-48"
        >
          <option value="">All permitted branches</option>
          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-(--danger-soft) p-3 text-sm text-(--danger)"
        >
          {error}
        </p>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Products stocked"
              value={summary.totalProducts || 0}
              icon={<Package size={18} />}
            />
            <SummaryCard
              title="Stock units"
              value={summary.totalStockUnits || 0}
              icon={<ShoppingBag size={18} />}
            />
            <SummaryCard
              title="Stock value"
              value={cash(summary.totalInventoryValue || 0)}
              icon={<ClipboardList size={18} />}
            />
            <SummaryCard
              title="Low stock"
              value={summary.lowStockProducts || 0}
              icon={<AlertTriangle size={18} />}
            />
            <SummaryCard
              title="Out of stock"
              value={summary.outOfStockProducts || 0}
              icon={<Package size={18} />}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <DataTableSection
              title="Branch inventory"
              description="On-hand units and purchase-price stock value by branch."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-(--ink-muted)">
                      <th className="p-3">Branch</th>
                      <th className="p-3">Products</th>
                      <th className="p-3">Units</th>
                      <th className="p-3">Stock value</th>
                      <th className="p-3">Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      (dashboard?.branchSummary || []) as Record<
                        string,
                        unknown
                      >[]
                    ).map((row, index) => (
                      <tr key={index} className="border-t border-(--line)">
                        <td className="p-3 font-semibold">
                          {String(row.branch || "Branch")}
                        </td>
                        <td className="p-3">{String(row.products || 0)}</td>
                        <td className="p-3">{String(row.units || 0)}</td>
                        <td className="p-3">{cash(Number(row.value || 0))}</td>
                        <td className="p-3">
                          {String(row.lowStock || 0)} low ·{" "}
                          {String(row.outOfStock || 0)} out
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataTableSection>
            <DataTableSection
              title="Recent stock movements"
              description="Latest purchases, sales, adjustments, transfers, and returns."
            >
              <MovementTable
                rows={(dashboard?.recentMovements || []) as InventoryMovement[]}
              />
            </DataTableSection>
          </div>
        </div>
      )}

      {tab === "products" && (
        <DataTableSection
          title="Products and branch stock"
          description="Product catalog and inventory levels by branch."
          toolbar={
            <DataTableToolbar
              className="lg:!flex-wrap"
              actions={
                canPurchase ? (
                  <Button
                    variant="outline"
                    onClick={() => openMovement("PURCHASE")}
                  >
                    Receive stock
                  </Button>
                ) : undefined
              }
            >
              <div data-toolbar-search className="relative w-full lg:w-[260px]">
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products or SKU"
                  aria-label="Search products or SKU"
                  leftIcon={<Search size={16} />}
                />
              </div>
              <Select
                aria-label="Filter category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="lg:w-[130px]"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="lg:w-[130px]"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCONTINUED">Discontinued</option>
              </Select>
              <Select
                aria-label="Filter stock state"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                className="lg:w-[150px]"
              >
                <option value="">All stock states</option>
                <option value="IN_STOCK">In stock</option>
                <option value="LOW_STOCK">Low stock</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
                <option value="NOT_STOCKED">Not stocked</option>
              </Select>
            </DataTableToolbar>
          }
        >
          {!filteredProducts.length ? (
            <EmptyState
              icon={<Package size={24} />}
              title="No products found"
              description="Create a product to start managing merchandise stock."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="text-left text-(--ink-muted)">
                    {[
                      "Product",
                      "SKU",
                      "Category",
                      "Branch",
                      "On hand",
                      "Reserved",
                      "Minimum",
                      "Purchase / Sale",
                      "Stock state",
                      "Actions",
                    ].map((label) => (
                      <th className="p-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.flatMap((product) =>
                    (product.inventory?.length
                      ? product.inventory
                      : [null]
                    ).map((row, index) => (
                      <tr
                        key={`${product._id}-${row ? (typeof row.branch === "string" ? row.branch : row.branch._id) : `empty-${index}`}`}
                        className="border-t border-(--line)"
                      >
                        <td className="p-3 font-semibold">
                          {product.name}
                          {product.isPublished && (
                            <span className="ml-2 text-xs text-(--success)">
                              Public
                            </span>
                          )}
                        </td>
                        <td className="p-3"><span className="inline-flex items-center gap-1.5 font-mono text-xs"><span>{product.sku}</span><CopyButton value={product.sku} label="SKU" /></span></td>
                        <td className="p-3">{product.category}</td>
                        <td className="p-3">
                          {row ? nameOf(row.branch) : "No branch stock"}
                        </td>
                        <td className="p-3">{row?.quantity ?? 0}</td>
                        <td className="p-3">{row?.reservedQuantity ?? 0}</td>
                        <td className="p-3">{row?.minimumStock ?? 0}</td>
                        <td className="p-3">
                          {cash(row?.purchasePrice ?? 0)} /{" "}
                          {cash(product.sellingPrice)}
                        </td>
                        <td className="p-3">
                          {row ? (
                            <StockBadge state={row.stockState} />
                          ) : (
                            <Badge variant="neutral">Not stocked</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {canUpdate && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openProduct(product)}
                              >
                                Edit
                              </Button>
                            )}
                            {canPurchase && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openMovement("PURCHASE", product)
                                }
                              >
                                Purchase
                              </Button>
                            )}
                            {row && canUpdate && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void editMinimumStock(product, row)
                                }
                              >
                                Threshold
                              </Button>
                            )}
                            {row && canAdjust && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openMovement("ADJUSTMENT", product)
                                }
                              >
                                Adjust
                              </Button>
                            )}
                            {row && canDamage && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openMovement("DAMAGE", product)}
                              >
                                Damage
                              </Button>
                            )}
                            {row && canSale && (
                              <Button
                                size="sm"
                                onClick={() => openMovement("ORDER", product)}
                              >
                                Order
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DataTableSection>
      )}

      {tab === "movements" && (
        <DataTableSection
          title="Stock movement history"
          description="Immutable records of every stock operation."
        >
          <MovementTable rows={movements} />
        </DataTableSection>
      )}
      {tab === "transfers" && (
        <DataTableSection
          title="Branch transfers"
          description="Each transfer records matching source and destination movements."
          toolbar={
            canTransfer ? (
              <Button
                leftIcon={<ArrowLeftRight size={16} />}
                onClick={() => openMovement("TRANSFER")}
              >
                Transfer stock
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-(--ink-muted)">
                  <th className="p-3">Date</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">From</th>
                  <th className="p-3">To</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((item, index) => (
                  <tr
                    key={String(item._id || index)}
                    className="border-t border-(--line)"
                  >
                    <td className="p-3">
                      {new Date(String(item.occurredAt)).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {String(
                        (item.product as Record<string, unknown>)?.name ||
                          "Product",
                      )}
                    </td>
                    <td className="p-3">
                      {nameOf(item.sourceBranch as { name: string })}
                    </td>
                    <td className="p-3">
                      {nameOf(item.destinationBranch as { name: string })}
                    </td>
                    <td className="p-3">{String(item.quantity || 0)}</td>
                    <td className="p-3">{String(item.reason || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableSection>
      )}
      {tab === "orders" && (
        <DataTableSection
          title="Merchandise orders"
          description="Orders reserve stock and generate invoices in Fees & Payments."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-(--ink-muted)">
                  <th className="p-3">Order</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} className="border-t border-(--line)">
                    <td className="p-3"><span className="inline-flex items-center gap-1.5 font-semibold"><span>{order.orderNumber}</span><CopyButton value={order.orderNumber} label="Order reference" /></span></td>
                    <td className="p-3">{nameOf(order.student)}</td>
                    <td className="p-3">{nameOf(order.branch)}</td>
                    <td className="p-3">{cash(order.total)}</td>
                    <td className="p-3">{order.paymentStatus}</td>
                    <td className="p-3">{order.status}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5">{order.invoice?.invoiceNumber || "—"}{order.invoice?.invoiceNumber && <CopyButton value={order.invoice.invoiceNumber} label="Invoice number" />}</span>
                      {order.invoice?.balance
                        ? ` · due ${cash(order.invoice.balance)}`
                        : ""}
                    </td>
                    <td className="p-3">
                      {canSale && order.status === "PAYMENT_PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => openCancelOrder(order)}
                        >
                          Cancel
                        </Button>
                      )}
                      {canReturn && order.status === "PAID" && (
                        <ReturnButton order={order} onDone={refresh} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableSection>
      )}
      {tab === "suppliers" && (
        <DataTableSection
          title="Suppliers"
          description="Shared supplier details linked from products and branch stock."
          toolbar={
            canManage ? (
              <Button
                leftIcon={<Plus size={16} />}
                onClick={() => setSupplierModal(true)}
              >
                Add supplier
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((supplier) => (
              <Card key={supplier._id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">{supplier.name}</h3>
                    <p className="mt-1 text-sm text-(--ink-muted)">
                      {supplier.contactPerson || "No contact"}
                    </p>
                    <div className="mt-1 space-y-1 text-sm text-(--ink-muted)">
                      {supplier.phone && <div className="flex items-center gap-1.5"><span>{supplier.phone}</span><CopyButton value={supplier.phone} label={`${supplier.name} phone number`} /></div>}
                      {supplier.email && <div className="flex items-center gap-1.5"><span className="break-all">{supplier.email}</span><CopyButton value={supplier.email} label={`${supplier.name} email address`} /></div>}
                      {!supplier.phone && !supplier.email && <p>No contact details</p>}
                    </div>
                  </div>
                  <Badge
                    variant={
                      supplier.status === "ACTIVE" ? "success" : "neutral"
                    }
                  >
                    {supplier.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          {!suppliers.length && (
            <EmptyState
              icon={<Truck size={24} />}
              title="No suppliers yet"
              description="Add a supplier to associate it with products or branch stock."
            />
          )}
        </DataTableSection>
      )}
      {tab === "reports" &&
        (canReport ? (
          <DataTableSection
            title="Inventory reports"
            description="Inventory value uses purchase price. Sales revenue uses the price captured at sale."
          >
            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  title="Stock units"
                  value={Number(
                    (reports?.stockValue as Record<string, number>)
                      ?.totalUnits || 0,
                  )}
                />
                <SummaryCard
                  title="Stock valuation"
                  value={cash(
                    Number(
                      (reports?.stockValue as Record<string, number>)
                        ?.inventoryValue || 0,
                    ),
                  )}
                />
                <SummaryCard
                  title="Low / out of stock"
                  value={((reports?.lowStock as unknown[]) || []).length}
                />
              </div>
              <section className="space-y-2">
                <h3 className="font-bold">Best selling</h3>
                <ReportTable
                  rows={
                    (reports?.bestSelling || []) as Record<string, unknown>[]
                  }
                />
              </section>
              <section className="space-y-2">
                <h3 className="font-bold">Branch inventory</h3>
                <ReportTable
                  rows={
                    (reports?.branchInventory || []) as Record<
                      string,
                      unknown
                    >[]
                  }
                />
              </section>
            </div>
          </DataTableSection>
        ) : (
          <ErrorState message="Your role does not include inventory reporting." />
        ))}

      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={productForm.id ? "Edit product" : "Add product"}
        description="SKU is fixed after creation so stock history remains traceable."
        footer={
          <>
            <Button variant="outline" onClick={() => setProductModal(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void saveProduct()}>
              Save product
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product name">
            <Input
              value={productForm.name}
              onChange={(e) =>
                setProductForm({ ...productForm, name: e.target.value })
              }
            />
          </Field>
          <Field label="SKU">
            <Input
              disabled={Boolean(productForm.id)}
              value={productForm.sku}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  sku: e.target.value.toUpperCase(),
                })
              }
            />
          </Field>
          <Field label="Category">
            <Select
              value={productForm.category}
              onChange={(e) =>
                setProductForm({ ...productForm, category: e.target.value })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={productForm.status}
              onChange={(e) =>
                setProductForm({ ...productForm, status: e.target.value })
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCONTINUED">Discontinued</option>
            </Select>
          </Field>
          <Field label="Selling price">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={productForm.sellingPrice}
              onChange={(e) =>
                setProductForm({ ...productForm, sellingPrice: e.target.value })
              }
            />
          </Field>
          <Field label="Supplier">
            <Select
              value={productForm.supplier}
              onChange={(e) =>
                setProductForm({ ...productForm, supplier: e.target.value })
              }
            >
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option value={supplier._id} key={supplier._id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Image URL">
            <Input
              value={productForm.imageUrl}
              onChange={(e) =>
                setProductForm({ ...productForm, imageUrl: e.target.value })
              }
              placeholder="https://... or /images/..."
            />
          </Field>
          <Field label="Description" wide>
            <Textarea
              value={productForm.description}
              onChange={(e) =>
                setProductForm({ ...productForm, description: e.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productForm.isPublished}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  isPublished: e.target.checked,
                })
              }
            />
            Publish on public merchandise page
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(movementModal)}
        onClose={() => setMovementModal(null)}
        title={movementTitle(movementModal)}
        description={
          movementModal === "ORDER"
            ? "Unpaid orders reserve branch stock and create an invoice. Stock is sold only after full payment is recorded."
            : "All stock operations require a reason and create immutable movement history."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setMovementModal(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void submitMovement()}>
              {movementModal === "ORDER"
                ? "Create order"
                : movementModal === "TRANSFER"
                  ? "Transfer stock"
                  : "Save movement"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product">
            <Select
              value={movementForm.productId}
              onChange={(e) =>
                setMovementForm({ ...movementForm, productId: e.target.value })
              }
            >
              <option value="">Choose product</option>
              {products
                .filter((product) => product.status === "ACTIVE")
                .map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
            </Select>
          </Field>
          {movementModal === "ORDER" && (
            <Field label="Student ID">
              <Input
                value={movementForm.studentId}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    studentId: e.target.value,
                  })
                }
                placeholder="Student record ID"
              />
            </Field>
          )}
          <Field label="Product">
            <Select
              value={movementForm.productId}
              onChange={(e) =>
                setMovementForm({ ...movementForm, productId: e.target.value })
              }
            >
              <option value="">Choose a product</option>
              {products
                .filter((product) => product.status === "ACTIVE")
                .map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
            </Select>
          </Field>
          {movementModal === "TRANSFER" ? (
            <>
              <Field label="Source branch">
                <Select
                  value={movementForm.sourceBranch}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      sourceBranch: e.target.value,
                    })
                  }
                >
                  <BranchOptions branches={branches} />
                </Select>
              </Field>
              <Field label="Destination branch">
                <Select
                  value={movementForm.destinationBranch}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      destinationBranch: e.target.value,
                    })
                  }
                >
                  <option value="">Choose branch</option>
                  <BranchOptions branches={branches} />
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Branch">
              <Select
                value={movementForm.branchId}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, branchId: e.target.value })
                }
              >
                <option value="">Choose branch</option>
                <BranchOptions branches={branches} />
              </Select>
            </Field>
          )}
          {movementModal === "ADJUSTMENT" ? (
            <Field label="Quantity change (+/-)">
              <Input
                type="number"
                step="1"
                value={movementForm.change}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, change: e.target.value })
                }
              />
            </Field>
          ) : (
            <Field label="Quantity">
              <Input
                type="number"
                min="1"
                step="1"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, quantity: e.target.value })
                }
              />
            </Field>
          )}
          {movementModal === "PURCHASE" && (
            <>
              <Field label="Purchase price">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movementForm.purchasePrice}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      purchasePrice: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Minimum stock">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={movementForm.minimumStock}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      minimumStock: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Supplier">
                <Select
                  value={movementForm.supplier}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      supplier: e.target.value,
                    })
                  }
                >
                  <option value="">Product supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {movementModal === "ORDER" && (
            <Field label="Fulfillment">
              <Select
                value={movementForm.fulfillment}
                onChange={(e) =>
                  setMovementForm({
                    ...movementForm,
                    fulfillment: e.target.value,
                  })
                }
              >
                <option value="PICKUP">Pickup</option>
                <option value="DELIVERY">Delivery</option>
              </Select>
            </Field>
          )}
          <Field label="Reason" wide>
            <Textarea
              value={movementForm.reason}
              onChange={(e) =>
                setMovementForm({ ...movementForm, reason: e.target.value })
              }
              placeholder={
                movementModal === "PURCHASE"
                  ? "Supplier invoice / purchase reason"
                  : movementModal === "DAMAGE"
                    ? "Damage/loss reason"
                    : movementModal === "ADJUSTMENT"
                      ? "Stock count correction reason"
                      : "Operation reason"
              }
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        title="Add supplier"
        description="Supplier records are shared and reused by products and stock entries."
        footer={
          <>
            <Button variant="outline" onClick={() => setSupplierModal(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void saveSupplier()}>
              Save supplier
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={supplierForm.name}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, name: e.target.value })
              }
            />
          </Field>
          <Field label="Contact person">
            <Input
              value={supplierForm.contactPerson}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  contactPerson: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={supplierForm.phone}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, phone: e.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={supplierForm.email}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, email: e.target.value })
              }
            />
          </Field>
          <Field label="Address" wide>
            <Textarea
              value={supplierForm.address}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, address: e.target.value })
              }
            />
          </Field>
          <Field label="Notes" wide>
            <Textarea
              value={supplierForm.notes}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, notes: e.target.value })
              }
            />
          </Field>
        </div>
      </Modal>
      <Modal
        open={Boolean(thresholdTarget)}
        onClose={() => !busy && setThresholdTarget(null)}
        title="Update low-stock threshold"
        description={
          thresholdTarget
            ? `${thresholdTarget.product.name} at ${nameOf(thresholdTarget.row.branch)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setThresholdTarget(null)}
            >
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void saveMinimumStock()}>
              Save threshold
            </Button>
          </>
        }
      >
        <Field label="Minimum available stock">
          <Input
            type="number"
            min="0"
            step="1"
            value={thresholdValue}
            onChange={(event) => setThresholdValue(event.target.value)}
          />
        </Field>
      </Modal>
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => !busy && setCancelTarget(null)}
        title="Cancel merchandise order"
        description={
          cancelTarget
            ? `Cancel unpaid order ${cancelTarget.orderNumber}? The reserved stock will be released.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCancelTarget(null)}
            >
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void submitCancelOrder()}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <Field label="Cancellation reason">
          <Textarea
            required
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Why is this unpaid order being cancelled?"
          />
        </Field>
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label
      className={`block space-y-1.5 text-xs font-semibold text-(--ink-muted) ${wide ? "sm:col-span-2" : ""}`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
function BranchOptions({
  branches,
}: {
  branches: { _id: string; name: string }[];
}) {
  return (
    <>
      {branches.map((branch) => (
        <option value={branch._id} key={branch._id}>
          {branch.name}
        </option>
      ))}
    </>
  );
}
function StockBadge({ state }: { state: string }) {
  return (
    <Badge
      variant={
        state === "OUT_OF_STOCK"
          ? "danger"
          : state === "LOW_STOCK"
            ? "warning"
            : "success"
      }
    >
      {state.replaceAll("_", " ")}
    </Badge>
  );
}
function movementTitle(type: string | null) {
  return (
    (
      {
        PURCHASE: "Receive stock",
        ADJUSTMENT: "Adjust stock",
        DAMAGE: "Record damage or loss",
        TRANSFER: "Transfer between branches",
        ORDER: "Create merchandise order",
      } as Record<string, string>
    )[type || ""] || "Stock operation"
  );
}
function MovementTable({ rows }: { rows: InventoryMovement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-(--ink-muted)">
            <th className="p-3">Date</th>
            <th className="p-3">Product / SKU</th>
            <th className="p-3">Branch</th>
            <th className="p-3">Movement</th>
            <th className="p-3">Change</th>
            <th className="p-3">Previous → New</th>
            <th className="p-3">Reason / User</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-t border-(--line)">
              <td className="p-3">
                {new Date(row.occurredAt).toLocaleString()}
              </td>
              <td className="p-3">
                {nameOf(row.product)}
                <div className="text-xs text-(--ink-muted)">
                  {typeof row.product === "object" ? row.product.sku : ""}
                </div>
              </td>
              <td className="p-3">{nameOf(row.branch)}</td>
              <td className="p-3">
                <Badge variant="neutral">{row.type}</Badge>
              </td>
              <td className="p-3">
                {row.quantityDelta > 0 ? "+" : ""}
                {row.quantityDelta}
              </td>
              <td className="p-3">
                {row.previousQuantity} → {row.newQuantity}
              </td>
              <td className="p-3">
                {row.reason}
                <div className="text-xs text-(--ink-muted)">
                  {row.performedBy?.name || ""}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <EmptyState
          icon={<ClipboardList size={24} />}
          title="No stock movements"
          description="Purchases, adjustments, sales, and transfers will appear here."
        />
      )}
    </div>
  );
}
function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-(--ink-muted)">
            <th className="p-2">Product</th>
            <th className="p-2">SKU</th>
            <th className="p-2">Branch</th>
            <th className="p-2">Units</th>
            <th className="p-2">Value / Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, index) => (
            <tr key={index} className="border-t border-(--line)">
              <td className="p-2">{String(row.product || "—")}</td>
              <td className="p-2">{String(row.sku || "—")}</td>
              <td className="p-2">{String(row.branch || "—")}</td>
              <td className="p-2">
                {String(row.quantitySold ?? row.quantity ?? "—")}
              </td>
              <td className="p-2">
                {cash(Number(row.revenue ?? row.value ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ReturnButton({
  order,
  onDone,
}: {
  order: InventoryOrder;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [quantityValue, setQuantityValue] = useState("1");
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<"RESTOCK" | "DAMAGED_RETURN">(
    "RESTOCK",
  );
  const item = order.items.find((row) => row.returnedQuantity < row.quantity);
  const remainingQuantity = item ? item.quantity - item.returnedQuantity : 0;

  const submitReturn = async () => {
    if (!item) return;
    const quantity = Number(quantityValue);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Enter a whole-number return quantity greater than zero.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A return reason is required.");
      return;
    }

    setBusy(true);
    try {
      await inventoryRequest(
        `/orders/${order._id}/items/${item._id}/returns`,
        "POST",
        { quantity, reason, disposition, idempotencyKey: newKey() },
      );
      toast.success("Return recorded.");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Return failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !item}
        onClick={() => {
          setQuantityValue("1");
          setReason("");
          setDisposition("RESTOCK");
          setOpen(true);
        }}
      >
        Return
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Return merchandise"
        description={
          item
            ? `${item.name} · ${remainingQuantity} available to return`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void submitReturn()}>
              Record return
            </Button>
          </>
        }
      >
        {item && (
          <div className="grid gap-3">
            <Field label="Quantity">
              <Input
                type="number"
                min="1"
                max={remainingQuantity}
                step="1"
                value={quantityValue}
                onChange={(event) => setQuantityValue(event.target.value)}
              />
            </Field>
            <Field label="Return reason">
              <Textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Field label="Disposition">
              <Select
                value={disposition}
                onChange={(event) =>
                  setDisposition(
                    event.target.value as "RESTOCK" | "DAMAGED_RETURN",
                  )
                }
              >
                <option value="RESTOCK">Restock returned item</option>
                <option value="DAMAGED_RETURN">Mark as damaged</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
