# Hodlo.AI Meme Trader

> **Community-Driven Fully Automated Meme Coin Trading Bot for the Solana Ecosystem**  
> Built for the Solana Hackathon — aggregating real-time alpha calls from multiple communities, filtering noise with algorithms, and executing on-chain trades in milliseconds.

---

## Core Idea: Let Communities Find Alpha, Let the Machine Trade It

The best meme coin alpha is hidden inside Telegram, Discord, and private trading communities.

Every day, thousands of CA (Contract Address) calls flood these groups — but:

- **99% are noise** — fake hype, coordinated shills, exit liquidity traps
- **Real alpha disappears within seconds** — when multiple top-tier communities mention the same token simultaneously, the opportunity window is extremely short

Hodlo.AI Meme Trader solves this problem by building a fully automated pipeline:

**Multi-source community signal streams → intelligent filtering → automatic on-chain execution → automated position management**

Humans choose the communities.  
The system handles everything else.

---

# Intelligent Community Signal Analysis

Every incoming CA signal carries detailed social and behavioral metadata.  
The filtering engine uses these dimensions to determine whether a trade is worth taking.

## Community Heat Metrics

| Field | Meaning | Usage |
|------|------|------|
| `qwfc` Global Mention Count | Total mentions across all connected communities | Minimum hype threshold |
| `bqfc` Local Group Mentions | Mentions inside the current source group | Community conviction strength |
| `fgq` Group Coverage Count | Number of independent groups mentioning the CA | **Critical signal: cross-community consensus** |
| `grcxcs` User Query Count | Number of users actively searching the token | Measures genuine attention |
| `cxrzf` Current Price Increase | How much the token already pumped before signal arrival | Anti-FOMO protection |

### Core Logic

A token only becomes a valid alpha signal when:

- Multiple independent communities mention it simultaneously
- The signal sender has a strong historical win rate
- Market and risk conditions remain within acceptable bounds

This dramatically reduces fake hype and late entries.

---

# Signal Sender Reputation System

The system builds a local reputation profile for every signal sender and continuously updates it based on real trading outcomes.

| Metric | Description |
|------|------|
| `sender_win_rate` | Historical global win rate |
| `sender_group_win_rate` | Win rate inside the current community |
| `sender_total_tokens` | Total number of historical calls |
| `sender_best_multiple` | Highest historical return multiple |

For new or unverified callers, strategies can be configured as:

- Skip entirely
- Enter with half size
- Normal execution

---

# Multi-Layer Filtering Engine

```text
Receive CA Signal
        ↓
Sender Validation
(win rate / history / performance)
        ↓
Anti-FOMO Protection
(skip overextended pumps)
        ↓
Community Heat Analysis
(group coverage / mentions / search activity)
        ↓
Market Data Validation
(market cap / buy pressure / momentum)
        ↓
Security Checks
(honeypot / mint risk / holder concentration)
        ↓
AUTO BUY EXECUTION
