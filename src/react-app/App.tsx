import CreatePage from "./pages/CreatePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import RevealPage from "./pages/RevealPage";
import Logo from "./components/Logo";

function useRoute() {
  const path = window.location.pathname;
  const revealMatch = /^\/s\/([^/]+)$/.exec(path);
  if (revealMatch) return { page: "reveal" as const, id: revealMatch[1] };
  if (path === "/how") return { page: "how" as const };
  return { page: "create" as const };
}

function App() {
  const route = useRoute();

  return (
    <>
      <div className="bg-grid" aria-hidden="true" />
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
          </nav>
        </header>

        <main className={route.page === "how" ? "page wide" : "page"}>
          {route.page === "reveal" && <RevealPage id={route.id} />}
          {route.page === "how" && <HowItWorksPage />}
          {route.page === "create" && <CreatePage />}
        </main>
      </div>
    </>
  );
}

export default App;
