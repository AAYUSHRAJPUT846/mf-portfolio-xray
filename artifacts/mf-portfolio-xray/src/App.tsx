import { useState, useRef, useEffect, useCallback } from "react";

const CHART_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type AnalysisResult = {
  totalValue: number;
  xirr: number;
  numberOfFunds: number;
  expenseDrag: number;
  funds: { name: string; percentage: number }[];
  overlapWarning: string;
  rebalancingAdvice: string;
};

type Screen = "upload" | "loading" | "results";

declare global {
  interface Window {
    Chart: any;
    pdfjsLib: any;
  }
}

function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function usePDFJS(): boolean {
  const [loaded, setLoaded] = useState(!!window.pdfjsLib);
  useEffect(() => {
    if (window.pdfjsLib) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = PDFJS_CDN;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      setLoaded(true);
    };
    document.head.appendChild(script);
  }, []);
  return loaded;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return fullText;
}

function useChartJS(): boolean {
  const [loaded, setLoaded] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

function DonutChart({ funds }: { funds: { name: string; percentage: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const chartLoaded = useChartJS();

  useEffect(() => {
    if (!chartLoaded || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    chartRef.current = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: funds.map((f) => f.name.split(" ").slice(0, 3).join(" ")),
        datasets: [{
          data: funds.map((f) => f.percentage),
          backgroundColor: CHART_COLORS,
          borderColor: "#1e293b",
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%` },
            backgroundColor: "#1e3a5f",
            titleColor: "#fff",
            bodyColor: "#94a3b8",
            borderColor: "#334155",
            borderWidth: 1,
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [chartLoaded, funds]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

function SummaryCard({ label, value, icon, accent }: {
  label: string; value: string; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 border transition-all hover:border-green-800"
      style={{
        background: "rgba(15,30,20,0.5)",
        borderColor: accent ? "rgba(34,197,94,0.3)" : "rgba(30,58,47,0.6)",
        boxShadow: accent ? "0 0 20px rgba(34,197,94,0.08)" : "none",
      }}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.12)" }}>
          {icon}
        </div>
      </div>
      <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</span>
    </div>
  );
}

function UploadPage({
  onAnalyse,
  error,
}: {
  onAnalyse: (file: File | null) => void;
  error: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfReady = usePDFJS();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") setFile(f);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d2235 50%, #0f1f14 100%)" }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-fade-in-up">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                <path d="M11 8v3l2 2" />
              </svg>
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase text-green-400">Portfolio Analytics</span>
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ background: "linear-gradient(90deg, #fff 0%, #22c55e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            MF Portfolio X-Ray
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-lg mt-1">
            Upload your CAMS statement and get a complete portfolio analysis in seconds
          </p>
        </div>

        <div
          className="w-full rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-5 cursor-pointer p-8 sm:p-12"
          style={{
            borderColor: dragOver ? "#22c55e" : "#1e3a2f",
            background: dragOver ? "rgba(34,197,94,0.07)" : "rgba(15,30,20,0.5)",
            minHeight: 240,
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.25)" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-green-400 font-semibold text-sm">{file.name}</span>
              <span className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB — ready to analyse</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-slate-200 font-medium text-sm sm:text-base">
                Drop your CAMS PDF here, or <span className="text-green-400 underline underline-offset-2">browse</span>
              </span>
              <span className="text-slate-500 text-xs sm:text-sm">Supports CAMS consolidated account statements (PDF)</span>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full rounded-xl px-4 py-3 border text-sm"
            style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <button
          onClick={() => onAnalyse(file)}
          disabled={!pdfReady || !file}
          className="w-full sm:w-auto px-10 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #22c55e, #15803d)",
            color: "#fff",
            boxShadow: "0 4px 24px rgba(34,197,94,0.3)",
          }}
        >
          {!pdfReady ? "Loading…" : !file ? "Select a PDF first" : "Analyse My Portfolio →"}
        </button>

        <div className="flex items-center gap-6 flex-wrap justify-center">
          {["Powered by Groq AI", "No data stored", "Instant results"].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-slate-500 text-xs">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingPage() {
  const steps = ["Extracting PDF text", "Sending to AI analyst", "Computing XIRR & metrics", "Generating insights"];
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActiveStep((s) => Math.min(s + 1, steps.length - 1)), 2000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d2235 50%, #0f1f14 100%)" }}>
      <div className="flex flex-col items-center gap-6 animate-fade-in-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-green-900"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-400 animate-spin-slow"></div>
          <div className="absolute inset-3 rounded-full flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.12)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold text-white">Analysing your portfolio…</h2>
          <p className="text-slate-400 text-sm max-w-xs">AI is reading your statement and computing metrics</p>
        </div>
        <div className="flex flex-col gap-2.5 w-64">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                style={{
                  background: i <= activeStep ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.08)",
                  border: `1px solid ${i <= activeStep ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.2)"}`,
                }}>
                {i < activeStep ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i === activeStep ? (
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-900"></div>
                )}
              </div>
              <span className="text-xs transition-colors duration-300"
                style={{ color: i <= activeStep ? "#94a3b8" : "#475569" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsPage({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const adviceLines = result.rebalancingAdvice
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d2235 50%, #0f1f14 100%)" }}>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 animate-fade-in-up">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MF Portfolio X-Ray</h1>
              <p className="text-slate-500 text-xs">AI analysis complete · {result.numberOfFunds} funds detected</p>
            </div>
          </div>
          <button onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-green-900 text-green-400 hover:bg-green-900/30 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload new statement
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard label="Total Value" value={formatINR(result.totalValue)} accent icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          } />
          <SummaryCard label="XIRR Return" value={`${result.xirr.toFixed(1)}%`} icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          } />
          <SummaryCard label="No. of Funds" value={String(result.numberOfFunds)} icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          } />
          <SummaryCard label="Expense Drag" value={`${result.expenseDrag.toFixed(2)}%`} icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          } />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-2xl p-5 sm:p-6 border flex flex-col gap-5"
            style={{ background: "rgba(15,30,20,0.5)", borderColor: "rgba(30,58,47,0.6)" }}>
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Portfolio Allocation</h2>
            <div className="relative flex justify-center" style={{ height: 220 }}>
              <DonutChart funds={result.funds} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-slate-400 text-xs">Total</span>
                <span className="text-white font-bold text-lg">{result.numberOfFunds} Funds</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {result.funds.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                    <span className="text-slate-300 text-xs truncate">{f.name}</span>
                  </div>
                  <span className="text-slate-200 text-xs font-medium w-10 text-right flex-shrink-0">{f.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5 sm:p-6 border flex flex-col gap-4"
            style={{ background: "rgba(15,20,30,0.5)", borderColor: "rgba(239,68,68,0.25)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Overlap Warning</h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{result.overlapWarning}</p>
          </div>
        </div>

        <div className="rounded-2xl p-5 sm:p-6 border"
          style={{ background: "rgba(10,25,10,0.6)", borderColor: "rgba(34,197,94,0.25)", boxShadow: "0 0 30px rgba(34,197,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.15)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">AI Rebalancing Recommendation</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
              Groq AI · llama-3.3-70b
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {adviceLines.map((line, i) => (
              <p key={i} className="text-slate-300 text-sm leading-relaxed">{line}</p>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-green-900/40 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-slate-500 text-xs">For informational purposes only. Not financial advice. Consult a SEBI-registered advisor before rebalancing.</span>
          </div>
        </div>

        <div className="rounded-2xl p-5 sm:p-6 border"
          style={{ background: "rgba(15,30,20,0.5)", borderColor: "rgba(30,58,47,0.6)" }}>
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-4">Fund Breakdown</h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[400px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(30,58,47,0.6)" }}>
                  {["Fund Name", "Allocation", "Weight"].map((h) => (
                    <th key={h} className="text-slate-500 font-medium text-left pb-2.5 px-2 uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.funds.map((f, i) => (
                  <tr key={i} className="border-b transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: "rgba(30,58,47,0.4)" }}>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                        <span className="text-slate-200 font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-800 rounded-full h-1.5 w-20">
                          <div className="h-1.5 rounded-full" style={{ width: `${f.percentage}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                        </div>
                        <span className="text-slate-300 font-medium">{f.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          background: i < 3 ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)",
                          color: i < 3 ? "#4ade80" : "#64748b",
                        }}>
                        {i < 3 ? "Top holding" : "Core"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyse = async (file: File | null) => {
    if (!file) { setError("Please select a PDF file first."); return; }
    setError(null);
    setScreen("loading");

    try {
      const text = await extractTextFromPDF(file);
      if (text.trim().length < 50) throw new Error("Could not read text from this PDF. Please use a text-based CAMS statement.");

      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");

      setResult(data as AnalysisResult);
      setScreen("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setScreen("upload");
    }
  };

  if (screen === "loading") return <LoadingPage />;
  if (screen === "results" && result) return <ResultsPage result={result} onReset={() => { setResult(null); setScreen("upload"); }} />;
  return <UploadPage onAnalyse={handleAnalyse} error={error} />;
}
