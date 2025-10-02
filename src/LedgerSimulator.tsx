import { useEffect, useMemo, useState } from "react";

/**
 * Ledger-Style Hardware Wallet Simulator
 * -------------------------------------
 * - Single-file React component (export default) ready to drop into any app.
 * - Uses Tailwind for styling; no extra CSS required.
 * - Simulates a tiny OLED screen, two physical buttons (◀ ▶) and a both-buttons "Confirm".
 * - Includes flows: Lock screen (PIN), App list, Show address, Review transaction, Settings.
 * - Keyboard shortcuts: Left=[ , Right= ] , Confirm= Enter, Power= P
 *
 * Notes:
 * - All crypto data is MOCKED for demo purposes; do not use for real signing.
 * - You can adapt the `apps` catalogue and wire into real APIs later.
 */

// ---- Utilities -------------------------------------------------------------
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Tiny deterministic pseudo-hash for demo addresses
function pseudoHash(input: string, len = 40) {
  let h1 = 0x811c9dc5, h2 = 0x45d9f3b;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= (h2 << 5) + (h2 >> 2) + input.charCodeAt(i);
    h2 >>>= 0;
  }
  const hex = (h: number) => ("00000000" + h.toString(16)).slice(-8);
  let out = "";
  while (out.length < len) out += hex(h1++) + hex(h2--);
  return out.slice(0, len);
}

function shorten(addr: string, prefix = 6, suffix = 6) {
  if (!addr) return "";
  return addr.slice(0, prefix) + "…" + addr.slice(-suffix);
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// ---- Types -----------------------------------------------------------------

type Screen =
  | { id: "SPLASH" }
  | { id: "LOCK"; pin: string; cursor: number }
  | { id: "HOME" }
  | { id: "APPS"; index: number }
  | { id: "ADDRESS"; app: WalletApp }
  | { id: "TX_REVIEW"; app: WalletApp; step: number; approved?: boolean }
  | { id: "SETTINGS"; index: number };

interface WalletApp {
  key: string;
  name: string;
  // address prefix and mock derivation
  address: (seed: string) => string;
  currency: string;
  decimals: number;
}

// ---- Demo App Catalogue ----------------------------------------------------
const apps: WalletApp[] = [
  {
    key: "btc",
    name: "Bitcoin",
    currency: "BTC",
    decimals: 8,
    address: (seed) => "bc1" + pseudoHash(seed + ":btc", 36),
  },
  {
    key: "eth",
    name: "Ethereum",
    currency: "ETH",
    decimals: 18,
    address: (seed) => "0x" + pseudoHash(seed + ":eth", 40),
  },
  {
    key: "sol",
    name: "Solana",
    currency: "SOL",
    decimals: 9,
    address: (seed) => pseudoHash(seed + ":sol", 44),
  },
];

// ---- Component -------------------------------------------------------------
export default function LedgerStyleSimulator() {
  const [powered, setPowered] = useState(true);
  const [seed] = useState(() => pseudoHash("demo-seed"));
  const [screen, setScreen] = useState<Screen>({ id: "SPLASH" });
  const [toast, setToast] = useState<string | null>(null);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p") {
        setPowered((v) => !v);
        e.preventDefault();
        return;
      }
      if (!powered) return;
      if (e.key === "[" || e.key === "ArrowLeft") { left(); e.preventDefault(); }
      else if (e.key === "]" || e.key === "ArrowRight") { right(); e.preventDefault(); }
      else if (e.key === "Enter") { confirm(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [powered, screen]);

  // Auto transition from splash to lock
  useEffect(() => {
    if (screen.id === "SPLASH") {
      const t = setTimeout(() => setScreen({ id: "LOCK", pin: "", cursor: 0 }), 800);
      return () => clearTimeout(t);
    }
  }, [screen.id]);

  // Simple UI helpers
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  function left() {
    if (!powered) return;
    if (screen.id === "APPS") {
      setScreen({ ...screen, index: clamp(screen.index - 1, 0, apps.length - 1) });
    } else if (screen.id === "TX_REVIEW") {
      setScreen({ ...screen, step: clamp(screen.step - 1, 0, txSteps.length - 1) });
    } else if (screen.id === "SETTINGS") {
      setScreen({ ...screen, index: clamp(screen.index - 1, 0, settingsMenu.length - 1) });
    } else if (screen.id === "LOCK") {
      setScreen({ ...screen, cursor: clamp(screen.cursor - 1, 0, 3) });
    }
  }

  function right() {
    if (!powered) return;
    if (screen.id === "APPS") {
      setScreen({ ...screen, index: clamp(screen.index + 1, 0, apps.length - 1) });
    } else if (screen.id === "TX_REVIEW") {
      setScreen({ ...screen, step: clamp(screen.step + 1, 0, txSteps.length - 1) });
    } else if (screen.id === "SETTINGS") {
      setScreen({ ...screen, index: clamp(screen.index + 1, 0, settingsMenu.length - 1) });
    } else if (screen.id === "LOCK") {
      setScreen({ ...screen, cursor: clamp(screen.cursor + 1, 0, 3) });
    }
  }

  function confirm() {
    if (!powered) return;
    if (screen.id === "LOCK") {
      // PIN is 1-2-3-4 in this demo
      if (screen.pin === "1234") {
        setScreen({ id: "HOME" });
      } else {
        // Add digit 0-9 at cursor; confirm when length=4
        const nextPin = screen.pin.padEnd(4, "_");
        const next = nextPin.split("");
        next[screen.cursor] = String(((Number(next[screen.cursor]) || 0) + 1) % 10);
        const committed = next.join("").replaceAll("_", "");
        setScreen({ id: "LOCK", pin: committed, cursor: screen.cursor });
        if (committed.length === 4) showToast(committed === "1234" ? "PIN OK" : "Wrong PIN");
        if (committed === "1234") setTimeout(() => setScreen({ id: "HOME" }), 300);
      }
    } else if (screen.id === "HOME") {
      setScreen({ id: "APPS", index: 0 });
    } else if (screen.id === "APPS") {
      const app = apps[screen.index];
      setScreen({ id: "ADDRESS", app });
    } else if (screen.id === "ADDRESS") {
      setScreen({ id: "TX_REVIEW", app: screen.app, step: 0 });
    } else if (screen.id === "TX_REVIEW") {
      if (screen.step < txSteps.length - 1) setScreen({ ...screen, step: screen.step + 1 });
      else setScreen({ ...screen, approved: true });
    } else if (screen.id === "SETTINGS") {
      const action = settingsMenu[screen.index].action;
      action?.();
    }
  }

  function back() {
    if (!powered) return;
    if (screen.id === "APPS" || screen.id === "SETTINGS") setScreen({ id: "HOME" });
    else if (screen.id === "ADDRESS") setScreen({ id: "APPS", index: 0 });
    else if (screen.id === "TX_REVIEW") setScreen({ id: "ADDRESS", app: screen.app });
  }

  // Settings actions
  const settingsMenu = [
    { label: "Brightness", action: () => showToast("Max") },
    { label: "About", action: () => showToast("v1.0 demo") },
    { label: "Lock", action: () => setScreen({ id: "LOCK", pin: "", cursor: 0 }) },
    { label: powered ? "Power Off" : "Power On", action: () => setPowered(!powered) },
  ];

  // Mock tx steps
  const tx = useMemo(() => ({
    to: apps[1].address(seed).slice(0, 42), // pretend an ETH tx
    amount: 0.042,
    fee: 0.00021,
    network: "Ethereum",
  }), [seed]);

  const txSteps = [
    { title: "Review", value: "Transaction" },
    { title: "Network", value: tx.network },
    { title: "To", value: shorten(tx.to, 10, 10) },
    { title: "Amount", value: `${tx.amount} ETH` },
    { title: "Max Fee", value: `${tx.fee} ETH` },
    { title: "Hold both", value: "to approve" },
  ];

  // ---- Renderers -----------------------------------------------------------
  const ScreenContent = () => {
    if (!powered) return <PowerOff />;
    switch (screen.id) {
      case "SPLASH":
        return <Splash />;
      case "LOCK":
        return <Lock pin={screen.pin} cursor={screen.cursor} />;
      case "HOME":
        return <Home onSettings={() => setScreen({ id: "SETTINGS", index: 0 })} />;
      case "APPS":
        return <Apps index={screen.index} />;
      case "ADDRESS":
        return <Address app={screen.app} seed={seed} />;
      case "TX_REVIEW":
        return <TxReview steps={txSteps} step={screen.step} approved={screen.approved} />;
      case "SETTINGS":
        return <Settings index={screen.index} menu={settingsMenu} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-neutral-100 text-neutral-900 flex items-start justify-center md:justify-start px-4 sm:px-6 lg:px-10 py-6">
      <div className="w-full max-w-none grid lg:grid-cols-[minmax(360px,520px)_1fr] gap-8">
        {/* Device */}
        <div className="bg-neutral-900 text-neutral-100 rounded-3xl p-5 shadow-xl relative">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold">Ledger‑style Simulator</h1>
            <button
              onClick={() => setPowered(!powered)}
              className={`px-3 py-1 rounded-full text-xs border ${powered ? "bg-emerald-600" : "bg-neutral-700"}`}
              aria-label="Power toggle"
            >
              {powered ? "On" : "Off"}
            </button>
          </div>

          {/* Device body */}
          <div className="bg-neutral-800 rounded-2xl p-4 shadow-inner">
            {/* Screen */}
            <div className="mx-auto w-[320px] h-[96px] bg-neutral-950 rounded-xl border border-neutral-700 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full px-4 py-3 font-mono text-xs tracking-tight text-neutral-200">
                <ScreenContent />
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <button onClick={left} className="py-2 rounded-xl bg-neutral-700 active:scale-95">◀ Left</button>
              <button onClick={confirm} className="py-2 rounded-xl bg-neutral-700 active:scale-95">⏺ Both</button>
              <button onClick={right} className="py-2 rounded-xl bg-neutral-700 active:scale-95">Right ▶</button>
            </div>

            {/* Back & Settings */}
            <div className="mt-3 flex gap-3">
              <button onClick={back} className="flex-1 py-2 rounded-xl bg-neutral-700 active:scale-95">Back</button>
              <button onClick={() => setScreen({ id: "SETTINGS", index: 0 })} className="flex-1 py-2 rounded-xl bg-neutral-700 active:scale-95">Settings</button>
            </div>

            <div className="text-[10px] text-neutral-400 mt-3">
              Tips: Left=[ or ←, Right=] or →, Confirm=Enter, Power=P.
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-200 text-neutral-900 text-xs px-3 py-2 rounded-full shadow">
              {toast}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="bg-white rounded-3xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">How to use</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Press <kbd className="px-1 py-0.5 bg-neutral-200 rounded">P</kbd> to power on/off.</li>
            <li>Enter demo PIN by pressing <kbd className="px-1 bg-neutral-200 rounded">Enter</kbd> a few times until it shows <code>1234</code>, then it will unlock.</li>
            <li>From Home, press <strong>Both</strong> to open Apps.</li>
            <li>Select an app with ◀ ▶ and press <strong>Both</strong> to view the mock address.</li>
            <li>Press <strong>Both</strong> again to go through a transaction review and approve at the end.</li>
            <li>Open <strong>Settings</strong> for power/lock actions.</li>
          </ol>
          <div className="mt-4 text-sm text-neutral-600">
            This is a demo UI. Replace the mocked data with real wallet calls to make it production‑ready.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Subcomponents ---------------------------------------------------------
function Splash() {
  return (
    <div className="w-full h-full flex items-center justify-center text-center animate-pulse">
      <div>
        <div className="text-[10px] tracking-widest text-neutral-400">HARDWARE WALLET</div>
        <div className="text-base font-bold">Welcome</div>
      </div>
    </div>
  );
}

function PowerOff() {
  return (
    <div className="w-full h-full flex items-center justify-center text-neutral-500">
      Powered off
    </div>
  );
}

function Lock({ pin, cursor }: { pin: string; cursor: number }) {
  const digits = pin.padEnd(4, "_").split("");
  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="flex items-center justify-between text-[10px] text-neutral-500">
        <span>🔒 Locked</span>
        <span>PIN</span>
      </div>
      <div className="flex items-center justify-center gap-3 text-xl">
        {digits.map((d, i) => (
          <span key={i} className={"px-2 py-1 rounded " + (i === cursor ? "bg-neutral-800 border border-neutral-700" : "")}>{d === "_" ? "•" : d}</span>
        ))}
      </div>
      <div className="text-[10px] text-center text-neutral-500">Press Both to increment a digit. Target PIN is 1234.</div>
    </div>
  );
}

function Home({ onSettings }: { onSettings: () => void }) {
  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto]">
      <div className="flex justify-between text-[10px] text-neutral-400">
        <span>🏠 Home</span>
        <span>12:00</span>
      </div>
      <div className="flex items-center justify-center text-center">
        <div>
          <div className="text-sm font-semibold">Open App</div>
          <div className="text-[10px] text-neutral-400">Press Both to continue</div>
        </div>
      </div>
      <div className="text-[10px] text-right text-neutral-500">
        ⚙️ <button onClick={onSettings} className="underline">Settings</button>
      </div>
    </div>
  );
}

function Apps({ index }: { index: number }) {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-neutral-400 flex justify-between"><span>📦 Apps</span><span>{index + 1}/{apps.length}</span></div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-bold">{apps[index].name}</div>
          <div className="text-[10px] text-neutral-400">Press Both</div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-500 text-center">◀ ▶ to cycle</div>
    </div>
  );
}

function Address({ app, seed }: { app: WalletApp; seed: string }) {
  const addr = app.address(seed);
  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto]">
      <div className="text-[10px] text-neutral-400 flex justify-between"><span>🔑 {app.name}</span><span>Address</span></div>
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-[10px] text-neutral-400 uppercase">Receive {app.currency}</div>
          <div className="text-xs break-all leading-tight">{addr}</div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-500 flex justify-between">
        <span>Press Both to send</span>
        <button className="underline" onClick={() => copy(addr)}>Copy</button>
      </div>
    </div>
  );
}

function TxReview({ steps, step, approved }: { steps: { title: string; value: string }[]; step: number; approved?: boolean }) {
  if (approved) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center">
        <div>
          <div className="text-sm font-semibold">✔ Approved</div>
          <div className="text-[10px] text-neutral-400">Transaction signed (demo)</div>
        </div>
      </div>
    );
  }
  const s = steps[step];
  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto]">
      <div className="text-[10px] text-neutral-400 flex justify-between"><span>📄 Review</span><span>{step + 1}/{steps.length}</span></div>
      <div className="flex items-center justify-center text-center">
        <div>
          <div className="text-[10px] uppercase text-neutral-400">{s.title}</div>
          <div className="text-sm font-semibold break-all leading-tight">{s.value}</div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-500 text-center">Use ◀ ▶, approve with Both</div>
    </div>
  );
}

function Settings({ index, menu }: { index: number; menu: { label: string; action?: () => void }[] }) {
  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr_auto]">
      <div className="text-[10px] text-neutral-400">⚙️ Settings</div>
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-semibold">{menu[index].label}</div>
          <div className="text-[10px] text-neutral-400">Press Both</div>
        </div>
      </div>
      <div className="text-[10px] text-neutral-500 text-center">◀ ▶ to navigate</div>
    </div>
  );
}

