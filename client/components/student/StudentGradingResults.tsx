"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ExternalLink } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState, LoadingSpinner } from "@/components/ui";
import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
type Result = { _id: string; result: "PASS" | "FAIL" | "PENDING"; overallScore: number; remarks: string; publishedAt: string; event?: { date: string; program?: { name: string }; examiner?: { name: string } }; promotion?: { fromBelt: string; toBelt: string } };
type Certificate = { _id: string; certificateNumber: string; kind: string; issuedAt: string; belt?: string; achievement?: string; programName?: string };

export default function StudentGradingResults() {
  const [results, setResults] = useState<Result[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchWithSession(`${API_URL}/grading/me`, { cache: "no-store" }).then((response) => response.json()),
      fetchWithSession(`${API_URL}/certificates/me`, { cache: "no-store" }).then((response) => response.json()),
    ]).then(([grading, certificateData]) => { if (active) { setResults(Array.isArray(grading.results) ? grading.results : []); setCertificates(Array.isArray(certificateData.certificates) ? certificateData.certificates : []); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Grading records could not be loaded."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Award size={18} className="text-(--accent)" /><h2 className="font-bold">Grading results & certificates</h2></div>
    {loading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : error ? <ErrorState title="Grading records unavailable" message={error} /> : results.length === 0 && certificates.length === 0 ? <EmptyState icon={<Award size={22} />} title="No published grading results" description="Published exam results and certificates will appear here." /> : <div className="space-y-3">{results.map((result) => <div key={result._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) p-4"><div><p className="font-semibold">{result.event?.program?.name || "Grading"} · {new Date(result.event?.date || result.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p><p className="mt-1 text-xs text-(--ink-muted)">Examiner: {result.event?.examiner?.name || "—"} · Score {result.overallScore}/100</p>{result.remarks && <p className="mt-2 text-sm text-(--ink-muted)">{result.remarks}</p>}{result.promotion && <p className="mt-2 text-sm font-semibold text-(--success)">{result.promotion.fromBelt} → {result.promotion.toBelt}</p>}</div><Badge variant={result.result === "PASS" ? "success" : result.result === "FAIL" ? "danger" : "warning"}>{result.result}</Badge></div>)}
      {certificates.length > 0 && <div className="border-t border-(--line) pt-3"><h3 className="mb-2 text-sm font-bold">Certificates</h3>{certificates.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) py-3 last:border-0"><div><p className="text-sm font-semibold">{item.belt ? `${item.belt} belt promotion` : item.achievement || item.programName || item.kind.replaceAll("_", " ")}</p><p className="text-xs text-(--ink-muted)">{item.certificateNumber} · {new Date(item.issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p></div><Link target="_blank" href={`/certificates/${item._id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-(--accent)">Print / download <ExternalLink size={14} /></Link></div>)}</div>}</div>}
  </Card>;
}
