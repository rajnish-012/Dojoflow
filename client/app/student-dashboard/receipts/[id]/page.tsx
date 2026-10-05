"use client";

import { useParams } from "next/navigation";
import ReceiptPrint from "@/components/finance/ReceiptPrint";

export default function StudentReceiptPage() {
  const params = useParams<{ id: string }>();
  return <ReceiptPrint receiptId={params.id} backHref="/student-dashboard" />;
}
