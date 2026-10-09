"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, Printer } from "lucide-react";
import { Button, CopyButton, ErrorState, LoadingSpinner } from "@/components/ui";
import { getCertificate, type CertificateRecord } from "@/lib/gradingApi";

export default function CertificatePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    getCertificate(id)
      .then((result) => { if (active) setCertificate(result.certificate); })
      .catch((reason) =>
        active && setError(
          reason instanceof Error
            ? reason.message
            : "Certificate could not be loaded.",
        ),
      );
    return () => { active = false; };
  }, [id]);
  if (error)
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState
          title="Certificate unavailable"
          message={error}
          action={
            <Link href="/grading">
              <Button variant="outline">Back to grading</Button>
            </Link>
          }
        />
      </div>
    );
  if (!certificate)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  const academy = certificate.academy || {};
  const achievement =
    certificate.kind === "BELT_PROMOTION"
      ? `${certificate.belt} Belt Promotion`
      : certificate.kind === "PROGRAM_COMPLETION"
        ? `${certificate.programName} Completion`
        : certificate.achievement;
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/grading"
          className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted)"
        >
          <ArrowLeft size={16} />
          Back to grading
        </Link>
        <Button leftIcon={<Printer size={16} />} onClick={() => window.print()}>
          Print / download PDF
        </Button>
      </div>
      <article
        className="certificate-sheet relative mx-auto flex min-h-[700px] max-w-4xl flex-col items-center justify-center overflow-hidden border-[12px] bg-white px-8 py-14 text-center shadow-xl sm:min-h-[790px] sm:px-16"
        style={{
          borderColor: academy.primaryColor || "#D7A84B",
          color: academy.secondaryColor || "#101A33",
        }}
      >
        <div className="pointer-events-none absolute inset-3 border border-current/20" />
        <div
          className="absolute left-1/2 top-7 h-1 w-28 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: academy.primaryColor || "#D7A84B" }}
        />
        {academy.logoUrl ? (
            <Image
              src={academy.logoUrl}
              alt="Academy logo"
              width={80}
              height={80}
              unoptimized
              className="mb-5 h-20 w-20 object-contain"
          />
        ) : (
          <div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2"
            style={{ borderColor: academy.primaryColor }}
          >
            <Award size={38} style={{ color: academy.primaryColor }} />
          </div>
        )}
        <p
          className="text-xs font-extrabold uppercase tracking-[0.28em]"
          style={{ color: academy.primaryColor }}
        >
          {academy.name || "ForceStrike Academy"}
        </p>
        <h1 className="mt-10 font-serif text-4xl font-bold tracking-wide sm:text-6xl">
          Certificate
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em]">
          of achievement
        </p>
        <p className="mt-12 text-sm text-slate-600">
          This certificate is proudly presented to
        </p>
        <p
          className="mt-3 border-b-2 px-8 pb-3 font-serif text-3xl font-bold sm:text-5xl"
          style={{ borderColor: academy.primaryColor }}
        >
          {certificate.studentName}
        </p>
        <p className="mt-8 max-w-2xl text-base leading-7 text-slate-700">
          In recognition of successfully achieving
        </p>
        <p
          className="mt-2 max-w-3xl text-2xl font-bold sm:text-3xl"
          style={{ color: academy.secondaryColor }}
        >
          {achievement}
        </p>
        {certificate.programName && (
          <p className="mt-3 text-sm text-slate-600">
            Program: {certificate.programName}
          </p>
        )}
        <div className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-8 text-left text-xs text-slate-600">
          <div className="border-t border-slate-300 pt-3">
            <span className="font-bold text-slate-800">Issued</span>
            <br />
            {new Date(certificate.issuedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="border-t border-slate-300 pt-3 text-right">
            <span className="font-bold text-slate-800">
              Certificate reference
            </span>
            <br />
            <span className="inline-flex items-center justify-end gap-1.5">{certificate.certificateNumber}<CopyButton value={certificate.certificateNumber} label="Certificate reference" className="border-slate-300 text-slate-600" /></span>
          </div>
        </div>
        <div className="mt-10 w-full max-w-2xl border-t border-slate-300 pt-3 text-center">
          <span className="font-serif text-lg italic text-slate-800">
            {certificate.examinerName ||
              (typeof certificate.issuedBy === "object"
                ? certificate.issuedBy?.name
                : "") ||
              "Academy Examiner"}
          </span>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Authorized Examiner
          </p>
        </div>
        <footer className="absolute bottom-7 left-0 right-0 px-6 text-[10px] text-slate-500">
          {[academy.address, academy.contactEmail, academy.contactPhone]
            .filter(Boolean)
            .join(" · ")}
        </footer>
      </article>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .certificate-sheet {
            min-height: 0;
            height: 100vh;
            max-width: none;
            box-shadow: none;
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: landscape;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
