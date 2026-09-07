"use client";

import { useEffect, useState } from "react";
import ReportResult from "@/components/reports/ReportResult";
import { mapAsyncSectionsToPdf, type AsyncSection } from "@/lib/reportPdfAdapter";
import type { ReportType } from "@/lib/reportEngine";

type InFlightStatus = "queued" | "processing" | "checking";
type TerminalStatus = "approved" | "rejected";
type ReportStatus = InFlightStatus | TerminalStatus;

interface OverviewRow {
  glyph?: string;
  label: string;
  value: string;
  note?: string;
}

interface PublicReport {
  id: number;
  title?: string | null;
  type?: string | null;
  status: string;
  paid?: boolean;
  overview?: OverviewRow[];
  sections?: AsyncSection[];
  pending?: boolean;
}

interface Props {
  readingId: number;
  type: string;
}

const POLL_INTERVAL_MS = 3_000;
const TERMINAL = new Set<TerminalStatus>(["approved", "rejected"]);

function normalizeStatus(status: string): ReportStatus {
  if (status === "approved" || status === "rejected") return status;
  if (status === "queued" || status === "processing" || status === "checking") return status;
  // Legacy/unknown states are never customer-visible; fail closed.
  return "rejected";
}

const STATUS_LABEL: Record<InFlightStatus, { label: string; eyebrow: string; step: number }> = {
  queued: {
    label: "Your chart is in the constellation room. Preparing your verified facts.",
    eyebrow: "Constellation Room",
    step: 0,
  },
  processing: {
    label: "Writing your personalized interpretation.",
    eyebrow: "Natal Writer",
    step: 1,
  },
  checking: {
    label: "Checking every claim against your chart.",
    eyebrow: "Quality Check",
    step: 2,
  },
};

const STEPS = ["Verified facts", "Writer", "Fact-check"];

function terminalMessage(): { eyebrow: string; title: string; body: string } {
  return {
    eyebrow: "Quality Protection",
    title: "This report did not pass our quality checks.",
    body: "We did not publish a version that was not fully backed by your verified chart facts.",
  };
}

export default function ReportProgress({ readingId, type }: Props) {
  const [report, setReport] = useState<PublicReport | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      timer = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      try {
        const response = await fetch("/api/profile/reports", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error("Could not load report status. Pull to refresh or retry.");
        }

        const payload = await response.json() as { reports?: PublicReport[] };
        const nextReport = payload.reports?.find((candidate) => candidate.id === readingId);
        if (!nextReport) {
          throw new Error("Report not found. It may have been removed.");
        }
        if (cancelled) return;

        setFetchError(null);
        const normalizedStatus = normalizeStatus(nextReport.status);
        setReport({ ...nextReport, status: normalizedStatus });
        if (!TERMINAL.has(normalizedStatus as TerminalStatus)) {
          scheduleNext();
        }
      } catch (error) {
        if (cancelled) return;
        setFetchError(error instanceof Error ? error.message : "Could not load report status.");
        scheduleNext();
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [readingId]);

  if (report?.status === "approved") {
    return (
      <ReportResult
        type={(report.type || type) as ReportType}
        title={report.title ?? undefined}
        overview={report.overview ?? []}
        sections={mapAsyncSectionsToPdf(report.sections)}
        readingId={report.id}
        paid={report.paid}
      />
    );
  }

  if (report && TERMINAL.has(report.status as TerminalStatus)) {
    const message = terminalMessage();
    return (
      <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 text-center" role="status" aria-live="polite">
        <p className="text-xs uppercase tracking-[0.4em] text-gold block mb-2">{message.eyebrow}</p>
        <h3 className="font-serif text-2xl text-white mb-3">{message.title}</h3>
        <p className="text-cosmic-200 text-sm max-w-lg mx-auto">{message.body}</p>
      </div>
    );
  }

  const status = report?.status ?? "queued";
  const progress = STATUS_LABEL[status as InFlightStatus];

  return (
    <div
      className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 text-center"
      role="progressbar"
      aria-valuetext={progress.label}
      aria-label="Report generation progress"
    >
      <div className="w-16 h-16 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center text-[#2DD4BF] text-3xl mx-auto mb-6 animate-pulse" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6" /><path d="M12 9v6" /><circle cx="12" cy="12" r="9" />
        </svg>
      </div>

      <span className="text-[10px] uppercase tracking-[0.4em] text-[#2DD4BF] block mb-2">{progress.eyebrow}</span>
      <h3 className="font-serif text-2xl text-white mb-2">{progress.label}</h3>

      <div className="max-w-md mx-auto mt-6 mb-6" role="presentation">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-white/5 -translate-y-1/2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2DD4BF] to-gold rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((progress.step + 1) / STEPS.length) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          {STEPS.map((label, index) => {
            const done = index < progress.step;
            const active = index === progress.step;
            return (
              <div key={label} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    done ? "border-gold bg-gold" : active ? "border-gold bg-white/90 ring-2 ring-gold/40" : "border-white/10 bg-white/5"
                  }`}
                  aria-hidden="true"
                />
                <span className={`text-[11px] leading-tight ${active ? "text-white font-medium" : done ? "text-gold/70" : "text-gray-500"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-cosmic-200 text-sm max-w-md mx-auto" aria-live="polite">
        {report?.pending ? "This may take a moment. Do not close this page." : "Preparing…"}
      </p>
      {fetchError && <p className="text-rose-300 text-sm mt-4" role="alert">{fetchError}</p>}
    </div>
  );
}
