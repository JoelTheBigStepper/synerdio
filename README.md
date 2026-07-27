# Synerdio

**Zero-install collaborative live debugger for the web.**

Inject a tiny agent into any webpage, create a room, and multiple developers share cursors, element highlighters, performance metrics, network data, and permission-based temporary CSS/JS patches — all in real time, with no accounts and no backend.

Built for hackathons and real-world pair debugging.

---

## Why Synerdio is different

Most tools either:

- Record sessions for later (Replay, FullStory, etc.), or
- Share code in an IDE (Live Share, CodeTogether), or
- Attach remote DevTools via CDP.

**Synerdio** does something rarer:

- Works on **any public page** via bookmarklet / one-liner
- True **simultaneous multiplayer** on the live DOM (cursors + highlighters everyone sees)
- **Live metrics** synced across peers
- **Permission-based temporary patches** that apply for the whole room
- Fully **serverless** (Trystero WebRTC + BroadcastChannel)
- Local AI pair (heuristics now, WebLLM-ready)
- **$0** infrastructure

---

## Quick Start

```bash
# Clone / unzip
cd synerdio

# Install
npm install

# Dev server
npm run dev

# Optional: build the injectable agent
npm run build:agent

# Production build
npm run build
```

Open the URL shown by Vite (usually http://localhost:5173).

### Deploy on Vercel

```bash
npm i -g vercel
vercel
```

Or connect the repo in the Vercel dashboard. Framework preset: Vite.

---

## How to use

### 1. Create or join a room
- Open the Synerdio web app
- Create a room (get a short Room ID) or join with an existing ID
- Share the Room ID or the URL (`?room=xxxxxxxx`)

### 2. Inject into a target page
**Option A – Bookmarklet**  
Drag the “Synerdio Inject” link from the landing page to your bookmarks bar.  
Click it on any website and paste the Room ID.

**Option B – Console**  
```js
const s = document.createElement('script')
s.src = 'https://YOUR-DEPLOYMENT/agent.js'
s.dataset.room = 'YOUR_ROOM_ID'
document.body.appendChild(s)
```

**Option C – Separate panel**  
Keep the Synerdio room page open in another tab while the agent runs on the target site.

### 3. Collaborate
- Move the mouse → peers see your cursor
- **Ctrl/Cmd + Click** an element → everyone sees the highlight
- Watch live metrics (TTFB, long tasks, resources, heap)
- Propose a temporary CSS/JS patch → peers vote → apply / revert for the room
- Ask the AI pair about jank, network, or memory
- Export a self-contained HTML report

---

## Color system

| Token            | Hex       | Usage                              |
|------------------|-----------|------------------------------------|
| Midnight Slate   | `#0B0F19` | Background (dark)                  |
| Electric Cyan    | `#00F0FF` | Data flow, active cursors, primary |
| Terminal Green   | `#10B981` | Success, applied patches           |
| Alert Amber      | `#F59E0B` | Warnings, long tasks, pending      |

Dark / light mode toggle is in the header.

---

## Architecture

```
synerdio/
├── src/
│   ├── agent/inject.js      # Vanilla JS agent (bookmarklet target)
│   ├── components/          # React UI (Panel, Metrics, Patches, AI…)
│   ├── hooks/
│   │   ├── useRoom.js       # Trystero presence + actions
│   │   └── useTheme.js
│   ├── App.jsx
│   └── index.css            # Tailwind v4 + design tokens
├── public/
│   └── agent.js             # Built agent (npm run build:agent)
└── ...
```

- **Room UI** → React + Vite + Tailwind CSS v4
- **Collaboration** → Trystero (serverless WebRTC) + BroadcastChannel fallback for same-origin tabs
- **Agent** → Pure JS, minimal footprint, injects highlighters, cursors, metrics, patch applicator
- **AI** → Offline heuristics today; drop in WebLLM / wllama later for full local models

---

## Feature checklist

- [x] Create / join room
- [x] Dark & light theme
- [x] Live metrics (navigation, resources, memory, long tasks)
- [x] Peer presence list
- [x] Shared cursors & element highlighters
- [x] Permission-based temporary patches (propose → vote → apply / revert)
- [x] AI pair (metrics-aware heuristics)
- [x] One-click HTML report export
- [x] Bookmarklet + console injection
- [x] Room URL sharing (`?room=`)
- [ ] Full WebLLM integration (stretch)
- [ ] Voice + drawing layer (stretch)
- [ ] Mini live time-travel buffer (stretch)

---

## Browser support

- **Chrome** — full support (PerformanceObserver long tasks, memory, WebRTC)
- **Safari** — core collaboration + metrics; long-task observer and `performance.memory` limited

---

## Security notes

- Patches are temporary and scoped to the current page session
- JS patches run with `new Function` in page context — only accept patches from people you trust in the room
- No data is sent to a central server; signaling is serverless
- Agent only runs when explicitly injected by the user

---

## License

MIT — build something great.

---

**Synerdio** — see the page the way your teammates see it, and fix it together.
