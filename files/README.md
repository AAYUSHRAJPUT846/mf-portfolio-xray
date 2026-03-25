# MF Portfolio X-Ray
### ET AI Hackathon 2026 — PS9: AI Money Mentor

> Upload your CAMS statement. Get a complete AI-powered portfolio analysis in under 15 seconds. Free for every Indian investor.

## Live Demo
**[mf-portfolio-x-ray--workaayushrajpu.replit.app](https://mf-portfolio-x-ray--workaayushrajpu.replit.app)**

---

## What It Does

MF Portfolio X-Ray gives every Indian mutual fund investor access to the kind of analysis that previously cost ₹2,000–₹5,000 and took days with a financial advisor.

Upload your CAMS or KFintech PDF statement and get instantly:

- **XIRR Calculator** — Your true annualised return, not just absolute gain
- **Portfolio Overlap Detector** — Find out if your funds hold the same stocks
- **Expense Ratio Drag** — See how much fees are silently eating your returns
- **Portfolio Health Score** — 0 to 100 rating with specific reasoning
- **AI Rebalancing Plan** — 3 specific actions mentioning your actual fund names
- **Benchmark Comparison** — Your XIRR vs Nifty 50's 13% CAGR

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | HTML, CSS, JavaScript, Chart.js | Free |
| PDF Parsing | pdf.js (Mozilla) — runs in browser | Free |
| AI Analysis | Groq API — Llama 3.3 70B | Free tier |
| Backend | Node.js + Express | Free |
| Hosting | Replit | Free |

**Total infrastructure cost: ₹0**

---

## Privacy

Your PDF never leaves your device. pdf.js extracts text in the browser. Only the extracted text is sent to our server — and it is never stored.

---

## Setup & Run Locally

```bash
git clone https://github.com/AAYUSHRAJPUT846/mf-portfolio-xray
cd mf-portfolio-xray
npm install
```

Add your Groq API key (free at console.groq.com):
```bash
export GROQ_API_KEY=your_key_here
```

```bash
node server.js
```

Open http://localhost:3000

---

## Impact

- **4.5 crore** mutual fund investors in India — all potential users
- **₹3,000** saved per user per year vs financial advisor fees  
- **15 seconds** vs 2–3 hours for traditional portfolio review
- **₹0** cost vs ₹2,000–₹5,000 per advisor session

---

## Team

Built at ET AI Hackathon 2026 by Team AAYUSHRAJPUT846
