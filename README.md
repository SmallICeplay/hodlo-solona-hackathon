````md
# Hodlo.AI Meme Trader

> **Community Signal-Driven Fully Automated Meme Coin Trading Bot** — Aggregates real-time alpha signals from multiple communities, filters noise with algorithms, and executes on-chain trades in milliseconds on Solana.

---

## Core Idea: Let Communities Pick the Coins, Let the Machine Execute the Trades

Meme coin alpha is hidden inside Telegram / WeChat communities. Every day countless groups are calling tokens, but:

- **99% is noise** — fake hype, manipulated shills, random calls
- **Real signals disappear instantly** — when multiple top-tier alpha groups mention the same token simultaneously, ordinary traders only have a few seconds to react

Hodlo.AI Meme Trader solves this exact problem:

**Aggregate real-time community signal streams → identify high-quality signals with algorithms → automatically execute on-chain trades → automatically manage TP/SL**

Humans choose the communities.  
The machine handles everything else.

---

## Intelligent Community Signal Analysis

Every CA signal received by the system carries complete community activity data.  
The filtering engine uses these metrics to make decisions:

### Community Activity Dimensions

| Field | Meaning | Usage |
|------|------|------|
| `qwfc` Global Mention Count | How many times this CA was mentioned across all connected communities | Minimum heat threshold |
| `bqfc` Local Group Mention Count | Mentions inside the current source group | Community conviction strength |
| `fgq` Group Coverage Count | Number of independent groups mentioning the same CA | **Key metric: cross-community consensus** |
| `grcxcs` User Query Count | Number of users actively searching the token | Real user attention |
| `cxrzf` Current Pump Multiple | How much the token already pumped before signal arrival | Anti-FOMO protection |

**Core Logic**:  
A CA only becomes a valid alpha signal when multiple independent communities mention it simultaneously (`fgq` high), and the caller has a strong historical win rate.

### Caller Reputation System

The system builds a local reputation profile for every signal sender and continuously tracks historical performance:

| Metric | Description |
|------|------|
| `sender_win_rate` | Global historical win rate |
| `sender_group_win_rate` | Win rate inside the current group |
| `sender_total_tokens` | Total number of historical calls |
| `sender_best_multiple` | Highest historical return multiple |

For new callers (without historical records), strategies can be configured as:

- Skip
- Half-size test position
- Normal execution

### Filtering Decision Flow

```text
Receive CA Signal
      ↓
Caller Validation → Win rate / total calls / historical best multiple not qualified? Skip
      ↓
Anti-FOMO Validation → Already pumped too much? Skip
      ↓
Community Heat Validation → Global mentions / group coverage / user queries insufficient? Skip
      ↓
Market Data Validation → Market cap / 5-minute momentum / 1-hour buy volume not qualified? Skip
      ↓
Security Validation → Honeypot / mint risk / high risk score / concentrated holders? Skip
      ↓
All Checks Passed → Automatically Buy (full-size or half-size)
```

All thresholds can be adjusted in real time from the configuration panel without restarting the system.

---

## Fully Automated Pipeline: From Signal to Execution

```text
Multi-Source Alpha Communities
       ↓ WebSocket Real-Time Streams
CA Listener (Auto Reconnect with Exponential Backoff)
       ↓ Millisecond Trigger
Filtering Engine (Multi-Dimensional Risk Control)
       ↓ Approved
AVE On-Chain Execution (Solana)
       ↓ Position Opened
Position Monitor (Polling Every 10 Seconds)
       ↓
Take Profit / Stop Loss / Timeout / Rug Detection
       ↓
Automatic Sell → PnL Recorded
```

**Latency**: Signal arrival → transaction broadcasted in **under 1 second**

---

## On-Chain Execution Quality

Buying is not just about sending transactions — execution reliability matters.

- **Pre-Trade Balance Validation** — skips execution when SOL/USDC balance is insufficient
- **Receipt Confirmation Polling** — waits for on-chain confirmation before opening positions
- **Nonce Rollback Handling** — properly releases failed transactions
- **Token-2022 Compatibility** — full support for new Solana meme assets
- **Real ATA Balance Validation** — checks actual on-chain balances before selling
- **Duplicate CA Lock Protection** — prevents concurrent duplicate buys

---

## Position Management

| Exit Condition | Description |
|----------|------|
| Take Profit | Automatically sell at target multiple |
| Stop Loss | Automatically cut losing positions |
| Timeout Exit | Force close after maximum holding duration |
| Rug Detection | Auto close when on-chain balance becomes zero |

All parameters are configurable.  
No manual monitoring required.

---

## Data Analytics

Trading does not end after closing positions.  
The system continuously accumulates data to improve strategies.

- **CA Performance Leaderboard** — best-performing CAs ranked by total PnL / win rate / max return
- **Signal Funnel Analytics** — received → filtered → executed conversion statistics
- **Caller Reputation Tracking** — continuously improving local alpha profiles
- **Complete Trade History** — entry price, exit price, exit reason, gas fee, TX hash

---

## Technical Architecture

```text
┌─────────────────────────────────────────────────┐
│              React 18 Frontend                   │
│      (Vite + Tailwind CSS + Recharts)            │
└──────────────────────┬──────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────┐
│           FastAPI Backend (Fully Async)          │
│                                                  │
│  CA Listener  →  Trade Engine  →  AVE Client     │
│  (WS Streams)      (Filtering)      (Execution)  │
│                                                  │
│  Position Monitor  ←→  Broadcaster               │
│  (TP/SL/Timeout/Rug)     (Realtime Push)         │
│                                                  │
│         SQLAlchemy Async (SQLite)                │
└─────────────────────────────────────────────────┘
                          ↓
                       Solana
```

| Layer | Technology |
|----|------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy async |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Blockchain | AVE Trading API, solders |
| Realtime | WebSocket |
| Database | SQLite |

---

## Quick Start

### Requirements

- Python 3.10+
- Node.js 18+

### Installation

```bash
git clone <repo-url>
cd meme-trader-main

pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### Configuration

```bash
cp .env.example .env
```

| Variable | Description |
|------|------|
| `AVE_API_KEY` | AVE Trading API key |
| `CA_WS_URL` | Community signal WebSocket endpoint |
| `WALLET_MASTER_PASSWORD` | Wallet encryption password |
| `BACKEND_PORT` | Backend port (default 8000) |

### Start

```bash
./start.sh      # Linux / Mac
start.bat       # Windows
```

- Dashboard: `http://localhost:5173`
- API Docs: `http://localhost:8000/docs`

---

## Project Structure

```text
backend/
├── services/
│   ├── ca_listener.py       # Community signal WebSocket listener
│   ├── trade_engine.py      # Signal filtering + trade decision
│   ├── position_monitor.py  # TP/SL automation
│   ├── ave_client.py        # Solana on-chain execution
│   └── wallet_manager.py    # AES encrypted wallet management
└── routers/                 # 40+ REST API endpoints

frontend/src/
├── App.jsx                  # Main dashboard
└── components/              # Positions, history, analytics, configuration panels
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md)

---

## Solana Hackathon

This project is built specifically for the Solana Hackathon ecosystem.

By transforming fragmented community alpha into a fully automated on-chain trading infrastructure, Hodlo.AI demonstrates how real-time social intelligence can be combined with Solana’s low-latency execution environment.

---

## Disclaimer

This project is for educational purposes and Solana Hackathon demonstrations only.

Cryptocurrency trading involves extremely high risk. Do not blindly trade with real funds.
````
