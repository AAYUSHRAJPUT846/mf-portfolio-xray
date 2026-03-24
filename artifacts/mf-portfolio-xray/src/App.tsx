import { useState, useRef, useEffect, useCallback } from "react";

const CHART_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

const BG = "#0f172a";
const CARD_BG = "#1e293b";
const BORDER = "#334155";
const GREEN = "#22c55e";
const GREEN_DIM = "rgba(34,197,94,0.12)";
const GREEN_BORDER = "rgba(34,197,94,0.3)";

const SAMPLE_TEXT = `CAMS Mutual Fund Statement. Investor: Rahul Sharma. Folio: 1234567.
Fund: Axis Bluechip Fund - Growth. Units: 150.234. NAV: 45.23. Value: 6792.08. Purchase Date: 2021-03-15. Amount Invested: 5000.
Fund: HDFC Mid Cap Opportunities - Growth. Units: 89.456. NAV: 78.45. Value: 7017.82. Purchase Date: 2020-11-20. Amount Invested: 4000.
Fund: SBI Small Cap Fund - Growth. Units: 45.123. NAV: 120.34. Value: 5430.49. Purchase Date: 2022-01-10. Amount Invested: 3000.
Fund: Mirae Asset Large Cap Fund. Units: 200.567. NAV: 34.56. Value: 6931.59. Purchase Date: 2021-07-05. Amount Invested: 5500.`;

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
  interface Window { Chart: any; pdfjsLib: any; }
}

function formatINR(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

function usePDFJS(): boolean {
  const [loaded, setLoaded] = useState(!!window.pdfjsLib);
  useEffect(() => {
    if (window.pdfjsLib) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = PDFJS_CDN;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; setLoaded(true); };
    document.head.appendChild(s);
  }, []);
  return loaded;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
}

function useChartJS(): boolean {
  const [loaded, setLoaded] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);
  return loaded;
}

function DonutChart({ funds }: { funds: { name: string; percentage: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const ready = useChartJS();

  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    chartRef.current = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: funds.map((f) => f.name),
        datasets: [{
          data: funds.map((f) => f.percentage),
          backgroundColor: CHART_COLORS,
          borderColor: BG,
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c: any) => ` ${c.label}: ${c.parsed.toFixed(1)}%` },
            backgroundColor: "#1e293b",
            titleColor: "#f1f5f9",
            bodyColor: "#94a3b8",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10,
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [ready, funds]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

function MetricCard({ label, value, sub, iconPath, valueColor }: {
  label: string;
  value: string;
  sub?: string;
  iconPath: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-5 border"
      style={{ background: CARD_BG, borderColor: BORDER }}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: GREEN_DIM }}>
          {iconPath}
        </div>
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: valueColor ?? "#f1f5f9" }}>
          {value}
        </div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">{title}</h2>
      {badge && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(34,197,94,0.15)", color: GREEN }}>{badge}</span>
      )}
    </div>
  );
}

function UploadPage({ onAnalyse, onTestSample, error }: {
  onAnalyse: (file: File | null) => void;
  onTestSample: () => void;
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
    if (f?.type === "application/pdf") setFile(f);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: GREEN }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">MF Portfolio X-Ray</span>
        </div>
        <span className="text-xs text-slate-500 hidden sm:block">ET AI Hackathon 2026</span>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl flex flex-col items-center gap-6 animate-fade-in-up">

          {/* Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium"
            style={{ borderColor: GREEN_BORDER, background: GREEN_DIM, color: GREEN }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill={GREEN} stroke="none">
              <circle cx="12" cy="12" r="12" />
            </svg>
            Powered by Groq AI — Free for every Indian investor
          </div>

          {/* Headline */}
          <div className="text-center flex flex-col gap-3">
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-none">
              <span className="text-white">MF Portfolio</span>{" "}
              <span style={{ color: GREEN }}>X-Ray</span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-md">
              Upload your CAMS statement and get an AI-powered portfolio analysis in seconds
            </p>
          </div>

          {/* Upload box */}
          <div
            className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer p-10 transition-all duration-200"
            style={{
              borderColor: dragOver ? GREEN : GREEN_BORDER,
              background: dragOver ? "rgba(34,197,94,0.06)" : "rgba(30,41,59,0.5)",
              minHeight: 200,
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />

            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: GREEN_DIM, border: `1.5px solid ${GREEN_BORDER}` }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>

            {file ? (
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color: GREEN }}>{file.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB · Ready to analyse</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-slate-200 font-medium text-sm">
                  Drop your CAMS PDF here, or <span style={{ color: GREEN }} className="underline underline-offset-2">browse</span>
                </p>
                <p className="text-slate-500 text-xs mt-1">Supports CAMS consolidated account statements (PDF)</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="w-full rounded-xl px-4 py-3 border flex items-center gap-2 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => onAnalyse(file)}
              disabled={!pdfReady || !file}
              className="w-full py-4 rounded-xl font-bold text-base transition-all duration-150 hover:opacity-90 active:scale-[0.985] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, #22c55e, #16a34a)`, color: "#fff", boxShadow: "0 4px 24px rgba(34,197,94,0.35)" }}
            >
              {!pdfReady ? "Loading pdf.js…" : !file ? "Select a PDF to continue" : "Analyse My Portfolio →"}
            </button>

            <button
              onClick={onTestSample}
              className="w-full py-3.5 rounded-xl font-semibold text-sm border transition-all duration-150 hover:bg-slate-700/50 flex items-center justify-center gap-2"
              style={{ borderColor: "#334155", color: "#94a3b8", background: "rgba(30,41,59,0.5)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Try with Sample Data
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-5 flex-wrap justify-center pt-1">
            {["Groq llama-3.3-70b", "No data stored", "Instant results"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-slate-500 text-xs">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function LoadingPage() {
  const steps = ["Extracting PDF text", "Sending to Groq AI", "Computing XIRR & metrics", "Generating insights"];
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setActiveStep((s) => Math.min(s + 1, steps.length - 1)), 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-4" style={{ background: BG }}>
      <div className="flex flex-col items-center gap-7 animate-fade-in-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full" style={{ border: `4px solid rgba(34,197,94,0.12)` }}></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-400 animate-spin-slow"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: GREEN_DIM }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Analysing your portfolio…</h2>
          <p className="text-slate-400 text-sm mt-1">Groq AI is reading your statement</p>
        </div>

        <div className="flex flex-col gap-3 w-60">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500"
                style={{
                  background: i <= activeStep ? "rgba(34,197,94,0.2)" : "rgba(30,41,59,0.8)",
                  border: `1.5px solid ${i <= activeStep ? GREEN : "#334155"}`,
                }}>
                {i < activeStep ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i === activeStep ? (
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }}></div>
                ) : null}
              </div>
              <span className="text-xs" style={{ color: i <= activeStep ? "#cbd5e1" : "#475569" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="py-4 px-6 border-t text-center" style={{ borderColor: BORDER }}>
      <span className="text-slate-600 text-xs">
        MF Portfolio X-Ray &mdash; ET AI Hackathon 2026 &nbsp;·&nbsp; Not financial advice
      </span>
    </div>
  );
}

function ResultsPage({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const adviceLines = result.rebalancingAdvice
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const xirrPositive = result.xirr >= 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>
      {/* Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ background: BG, borderColor: BORDER }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: GREEN }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">MF Portfolio X-Ray</span>
          <span className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "rgba(34,197,94,0.12)", color: GREEN }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
            Analysis Complete
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs hidden sm:block">{result.numberOfFunds} funds detected</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-7 animate-fade-in-up">

          {/* ── Metric cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              label="Total Portfolio Value"
              value={formatINR(result.totalValue)}
              sub="Current market value"
              valueColor={GREEN}
              iconPath={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <MetricCard
              label="XIRR Returns"
              value={`${xirrPositive ? "+" : ""}${result.xirr.toFixed(1)}%`}
              sub="Annualised return"
              valueColor={xirrPositive ? GREEN : "#ef4444"}
              iconPath={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                </svg>
              }
            />
            <MetricCard
              label="Number of Funds"
              value={String(result.numberOfFunds)}
              sub="Active schemes"
              iconPath={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              }
            />
            <MetricCard
              label="Expense Drag"
              value={`${result.expenseDrag.toFixed(2)}%`}
              sub="Weighted avg TER"
              valueColor="#ef4444"
              iconPath={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
          </div>

          {/* ── Chart + Overlap grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

            {/* Donut chart col (wider) */}
            <div className="lg:col-span-3 rounded-2xl border p-5 sm:p-6 flex flex-col gap-5"
              style={{ background: CARD_BG, borderColor: BORDER }}>
              <SectionHeader title="Portfolio Allocation" />
              <div className="relative flex justify-center" style={{ height: 230 }}>
                <DonutChart funds={result.funds} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-slate-500 text-xs">Portfolio</span>
                  <span className="text-white font-bold text-xl">{result.numberOfFunds} Funds</span>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {result.funds.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                    <span className="text-slate-400 text-xs truncate flex-1">{f.name}</span>
                    <span className="text-slate-200 text-xs font-semibold flex-shrink-0">{f.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlap warning col */}
            <div className="lg:col-span-2 rounded-2xl border p-5 sm:p-6 flex flex-col gap-4"
              style={{ background: "rgba(30,20,0,0.6)", borderColor: "rgba(234,179,8,0.4)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#eab308" }}>Overlap Warning</h2>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.2)" }}>
                <p className="text-slate-300 text-sm leading-relaxed">{result.overlapWarning}</p>
              </div>
              <p className="text-xs text-slate-600">High overlap between funds reduces diversification benefit.</p>
            </div>
          </div>

          {/* ── AI Rebalancing Plan ── */}
          <div className="rounded-2xl border p-5 sm:p-6"
            style={{ background: "rgba(10,30,15,0.7)", borderColor: GREEN_BORDER, boxShadow: "0 0 40px rgba(34,197,94,0.06)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white">Your AI Rebalancing Plan</h2>
              <span className="ml-auto text-[10px] px-2 py-1 rounded-full font-semibold hidden sm:block"
                style={{ background: GREEN_DIM, color: GREEN }}>
                Groq · llama-3.3-70b
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {adviceLines.map((line, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(34,197,94,0.15)", border: `1px solid ${GREEN_BORDER}` }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{line}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t flex items-start gap-2" style={{ borderColor: "rgba(34,197,94,0.15)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-slate-600 text-xs">For informational purposes only. Not financial advice. Consult a SEBI-registered advisor before rebalancing.</span>
            </div>
          </div>

          {/* ── Analyse Another button ── */}
          <div className="flex justify-center pb-2">
            <button onClick={onReset}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-sm border transition-all duration-150 hover:border-green-700 hover:text-green-300"
              style={{ borderColor: BORDER, color: "#94a3b8" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.88" />
              </svg>
              Analyse Another Portfolio
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callAnalyseAPI = async (text: string): Promise<AnalysisResult> => {
    const res = await fetch("/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed. Please try again.");
    return data as AnalysisResult;
  };

  const handleAnalyse = async (file: File | null) => {
    if (!file) { setError("Please select a PDF file first."); return; }
    setError(null);
    setScreen("loading");
    try {
      const text = await extractTextFromPDF(file);
      if (text.trim().length < 50) throw new Error("Could not read text from this PDF. Please use a text-based CAMS statement.");
      setResult(await callAnalyseAPI(text));
      setScreen("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setScreen("upload");
    }
  };

  const handleTestSample = async () => {
    setError(null);
    setScreen("loading");
    try {
      setResult(await callAnalyseAPI(SAMPLE_TEXT));
      setScreen("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setScreen("upload");
    }
  };

  const handleReset = () => { setResult(null); setError(null); setScreen("upload"); };

  if (screen === "loading") return <LoadingPage />;
  if (screen === "results" && result) return <ResultsPage result={result} onReset={handleReset} />;
  return <UploadPage onAnalyse={handleAnalyse} onTestSample={handleTestSample} error={error} />;
}
