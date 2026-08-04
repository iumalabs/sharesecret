import { useEffect, useState } from "react";

interface ApiParams {
  pinSize: number;
  maxExpireSeconds: number;
}

function App() {
  const [params, setParams] = useState<ApiParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/params")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json() as Promise<ApiParams>;
      })
      .then(setParams)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"));
  }, []);

  return (
    <main>
      <h1>ShareSecret</h1>
      <p>Zero-knowledge, one-time secret sharing on Cloudflare Workers.</p>
      {error && <p role="alert">Failed to reach API: {error}</p>}
      {params && (
        <p>
          PIN size: {params.pinSize} · Max expiry: {params.maxExpireSeconds}s
        </p>
      )}
    </main>
  );
}

export default App;
