import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export interface InventoryProduct {
  _id: string; name: string; sku: string; category: string; description: string; imageUrl: string;
  sellingPrice: number; status: string; isPublished: boolean; supplier?: { _id: string; name: string } | null;
  inventory?: InventoryRow[];
}
export interface InventoryRow {
  _id: string; product: InventoryProduct | string; branch: { _id: string; name: string } | string;
  quantity: number; reservedQuantity: number; minimumStock: number; purchasePrice: number;
  supplier?: { _id: string; name: string } | null; stockState: string;
}
export interface InventoryMovement {
  _id: string; product: { name: string; sku: string } | string; branch: { name: string } | string;
  type: string; quantity: number; quantityDelta: number; previousQuantity: number; newQuantity: number;
  reason: string; occurredAt: string; performedBy?: { name: string };
}
export interface InventoryOrder {
  _id: string; orderNumber: string; student: { name: string } | string; branch: { name: string } | string;
  items: { _id: string; product: string; name: string; sku: string; quantity: number; unitPrice: number; amount: number; returnedQuantity: number }[];
  total: number; status: string; paymentStatus: string; fulfillment: string;
  invoice?: { _id: string; invoiceNumber: string; status: string; balance: number } | null;
}

export const getInventoryProducts = (status = "ACTIVE") => request<{ products: InventoryProduct[] }>(`/products?status=${encodeURIComponent(status)}&limit=100`);

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetchWithSession(`${API_URL}/inventory${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { window.location.href = "/login"; throw new Error("Authentication required."); }
  if (!response.ok) throw new Error(data.message || "Inventory request failed");
  return data as T;
}

export const inventoryRequest = request;
