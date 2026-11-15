import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import Home from "./components/Home";
import "./index.css";

const App = lazy(() => import("./App"));

/** "/" is the landing page; "/app" (and any older deep link that carries ?site=… on "/") opens the navigator. */
const isApp = window.location.pathname.startsWith("/app") || new URLSearchParams(window.location.search).has("site");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isApp ? (
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading the navigator…</div>}>
        <App />
      </Suspense>
    ) : (
      <Home />
    )}
  </StrictMode>,
);
