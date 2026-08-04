import CreatePage from "./pages/CreatePage";
import RevealPage from "./pages/RevealPage";

function App() {
  const match = /^\/s\/([^/]+)$/.exec(window.location.pathname);

  return <main>{match ? <RevealPage id={match[1]} /> : <CreatePage />}</main>;
}

export default App;
