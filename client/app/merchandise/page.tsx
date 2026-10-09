"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, ShoppingBag } from "lucide-react";
import { Badge, Button, Card, LoadingSpinner, PageHeader } from "@/components/ui";

type PublicProduct = {
  _id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  imageUrl: string;
  sellingPrice: number;
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE";
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
const money = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const availability: Record<PublicProduct["availability"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  IN_STOCK: { label: "Available", tone: "success" },
  LOW_STOCK: { label: "Limited availability", tone: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", tone: "danger" },
  UNAVAILABLE: { label: "Availability on request", tone: "neutral" },
};

export default function MerchandisePage() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/public/website/merchandise`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Merchandise is unavailable right now.");
        return data.products as PublicProduct[];
      })
      .then((rows) => { if (active) setProducts(rows || []); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load merchandise."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-(--background) px-4 py-8 text-(--foreground) sm:px-8">
    <div className="mx-auto max-w-6xl space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted) hover:text-(--foreground)"><ArrowLeft size={16} /> Back to ForceStrike</Link>
      <PageHeader eyebrow="ForceStrike Academy" title="Academy merchandise" description="Browse academy gear and merchandise. Availability updates from branch stock." actions={<Link href="/inquiry"><Button leftIcon={<ShoppingBag size={16} />}>Ask about an item</Button></Link>} />
      {loading ? <div className="flex min-h-48 items-center justify-center"><LoadingSpinner text="Loading merchandise..." /></div>
        : error ? <p role="alert" className="rounded-xl bg-(--danger-soft) p-4 text-sm text-(--danger)">{error}</p>
        : products.length === 0 ? <Card><div className="flex flex-col items-center py-12 text-center"><Package className="text-(--ink-muted)" /><h2 className="mt-3 font-bold">No merchandise listed yet</h2><p className="mt-1 text-sm text-(--ink-muted)">Check back soon or contact the academy.</p></div></Card>
        : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => {
          const stock = availability[product.availability] || availability.UNAVAILABLE;
          return <Card key={product._id} className="overflow-hidden p-0">
            {product.imageUrl ? // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="h-56 w-full bg-(--hover-bg) object-cover" /> : <div className="flex h-56 items-center justify-center bg-(--hover-bg) text-(--ink-muted)"><Package size={36} /></div>}
            <div className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-(--ink-muted)">{product.category.replaceAll("_", " ")}</p><h2 className="mt-1 text-lg font-bold">{product.name}</h2></div><Badge variant={stock.tone}>{stock.label}</Badge></div>
              {product.description && <p className="line-clamp-3 text-sm text-(--ink-muted)">{product.description}</p>}
              <div className="flex items-center justify-between border-t border-(--line) pt-3"><span className="text-lg font-extrabold">{money(product.sellingPrice)}</span><Link href="/inquiry"><Button size="sm" variant="outline">Enquire</Button></Link></div>
            </div>
          </Card>;
        })}</div>}
    </div>
  </main>;
}
