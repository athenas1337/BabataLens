# Babata Lens — Personal AI Crypto Intelligence Workspace 🌐✨

**Babata Lens** is a responsive, calm, and intelligent crypto and blockchain intelligence workspace with a dedicated AI assistant named **Babata**. Built with Next.js App Router, TypeScript, Tailwind CSS, and Zod normalization, it follows the architectural specification in `BABATA_LENS_SPEC_v2.md`.

---

## 🔒 Where to Store All API Keys (Panduan Penyimpanan API Key)

### 1. Local Development (Komputer Lokal)
Simpan semua API key di dalam file:
```text
.env.local
```
di root directory proyek.

> [!IMPORTANT]
> File `.env.local` sudah tercantum di dalam `.gitignore` sehingga **kredensial aslimu tidak akan pernah terunggah ke GitHub atau terekspos ke publik**.
> Babata Lens dapat berjalan dengan normal meskipun kamu hanya mengisikan sebagian API key atau belum mengisi semuanya.

Cukup salin dari template `.env.example`:
```bash
cp .env.example .env.local
```

### 2. Production Deployment (Vercel / Cloud)
Jika kamu mendeploy proyek ini ke **Vercel** atau platform lain:
1. Buka dashboard proyek di Vercel: **Settings → Environment Variables**.
2. Masukkan key-key yang kamu butuhkan (misal: `GOOGLE_AI_API_KEY`, `ETHERSCAN_API_KEY`, dll).
3. Jangan pernah mencentang atau menambahkan prefix `NEXT_PUBLIC_` untuk secret API key agar kredensial tetap aman di sisi server saja.

---

## 🔑 Supported Providers & Variable Reference

| Provider Category | Key Name | Purpose |
|---|---|---|
| **Google AI (Gemini)** | `GOOGLE_AI_API_KEY` | Model analitik Babata (Gemini 1.5 Flash / Pro) |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | Model analitik Claude 3.5 Sonnet / Haiku |
| **OpenRouter** | `OPENROUTER_API_KEY` | Provider model multi-LLM fleksibel |
| **CoinGecko** | `COINGECKO_API_KEY` | Data harga token, volume, mcap & histori grafik |
| **CoinMarketCap** | `COINMARKETCAP_API_KEY` | Kuotasi harga & verifikasi perbandingan pasar |
| **Etherscan** | `ETHERSCAN_API_KEY` | Saldo wallet EVM, txlist & verifikasi smart contract |
| **Alchemy** | `ALCHEMY_API_KEY` | JSON-RPC multi-chain (Ethereum, Polygon, Arbitrum) |
| **Solscan** | `SOLSCAN_API_KEY` | Saldo & transaksi blockchain Solana |
| **BingX Exchange** | `BINGX_API_KEY`, `BINGX_API_SECRET` | Ticker harga & orderbook exchange |
| **Dune Analytics** | `DUNE_API_KEY` | Eksekusi kueri analitik on-chain |
| **Upstash Redis** | `UPSTASH_REDIS_REST_URL`, `TOKEN` | Distributed cache & rate limiting (opsional) |
| **PostgreSQL** | `DATABASE_URL` | Penyimpanan persisten percakapan & log (opsional) |

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Mode Development
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browsermu.

### 3. Menjalankan Automated Test Suite (Vitest)
```bash
npm run test
```

### 4. Build untuk Production
```bash
npm run build
```

---

## 🚀 Deployment

### Vercel (zero-config)
1. Push repo to GitHub, import project at [vercel.com/new](https://vercel.com/new).
2. Add environment variables from `.env.example` in **Settings → Environment Variables** (server-side only, no `NEXT_PUBLIC_` prefix for secrets).
3. Deploy. `next.config.mjs` already ships `images.unoptimized` for portability.

### Netlify
1. Push repo to GitHub, import at [app.netlify.com](https://app.netlify.com).
2. `netlify.toml` is included: build command `npm run build`, publish `.next`, using `@netlify/plugin-nextjs`.
3. Add the same environment variables in **Site settings → Environment variables**.

---

## 📱 Mobile-First Responsive Design
- **Android**: Navigasi bottom bar 5-item (`Home`, `Chat`, `Markets`, `Wallets`, `More`), touch target $\ge 44$px, font mudah dibaca, drawer menu untuk fitur sekunder.
- **Desktop**: Sidebar kiri ramping, layar luas untuk grafik perbandingan, pemantauan status kesehatan provider terintegrasi.
- **Aksesibilitas**: Mendukung `prefers-reduced-motion` dan kontras teks tinggi.
