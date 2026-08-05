import { useState } from "react";
import CreatePage from "./pages/CreatePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import RevealPage from "./pages/RevealPage";
import VaultPage from "./pages/VaultPage";
import Logo from "./components/Logo";
import GridBackground from "./components/GridBackground";
import { countLikelyLive, listVaultEntries } from "./lib/vault";

function useRoute() {
  const path = window.location.pathname;
  const revealMatch = /^\/s\/([^/]+)$/.exec(path);
  if (revealMatch) return { page: "reveal" as const, id: revealMatch[1] };
  if (path === "/how") return { page: "how" as const };
  if (path === "/vault") return { page: "vault" as const };
  return { page: "create" as const };
}

function App() {
  const route = useRoute();
  const [liveCount] = useState(() => countLikelyLive(listVaultEntries()));

  return (
    <>
      <GridBackground />
      <div className="bg-glow" aria-hidden="true" />

      <div className="shell">
        <header className="brand">
          <a href="/" className="brand-link">
            <span className="brand-mark" aria-hidden="true">
              <Logo size={20} />
            </span>
            <span className="brand-name">SHARESECRET</span>
          </a>

          <nav className="nav">
            <a href="/" aria-current={route.page === "create" ? "page" : undefined}>
              New secret
            </a>
            <a href="/how" aria-current={route.page === "how" ? "page" : undefined}>
              How it works
            </a>
            <a href="/vault" aria-current={route.page === "vault" ? "page" : undefined}>
              Vault{liveCount > 0 ? ` ${liveCount}` : ""}
            </a>
          </nav>
        </header>

        <main className={route.page === "how" || route.page === "vault" ? "page wide" : "page"}>
          {route.page === "reveal" && <RevealPage id={route.id} />}
          {route.page === "how" && <HowItWorksPage />}
          {route.page === "vault" && <VaultPage />}
          {route.page === "create" && <CreatePage />}
        </main>

        <footer className="site-footer">
          <span>SHARESECRET</span>
          <span className="site-footer-links">
            <a href="/how">Protocol</a>
            <a href="https://github.com/maksimyugai/sharesecret" target="_blank" rel="noreferrer">
              Source
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}

export default App;
