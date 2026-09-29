import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useJson } from "../api.js";
import Sidebar from "./Sidebar.jsx";

// Header, toolbar and (inside a space) the navigation tree - the SyteLine help library layout.
export default function Layout() {
  const { pathname } = useLocation();
  const [first, ...rest] = decodeURIComponent(pathname).split("/").filter(Boolean);
  const spaceKey = first && first !== "search" ? first : null;
  const { data: space } = useJson(spaceKey ? `/api/spaces/${spaceKey}` : null);
  const current = space && space.key === spaceKey ? space : null;

  return (
    <>
      <header className="top">
        <Link to="/" className="plain"><img src="/enflite-logo.png" alt="Enflite" /></Link>
        <span className="lib">{current ? current.name : "Enflite"} <b>Help</b></span>
      </header>
      <Toolbar homeTo={current ? `/${current.key}` : "/"} space={spaceKey} />
      <div className="wrap">
        {current && <Sidebar space={current} currentPath={rest.join("/")} />}
        <main>
          <div className="arc" />
          <div className="inner">
            <Outlet context={{ space: current }} />
            <footer>Enflite &middot; Help{current ? ` · ${current.name}` : ""}</footer>
          </div>
        </main>
      </div>
    </>
  );
}

function Toolbar({ homeTo, space }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/search?q=${encodeURIComponent(q.trim())}${space ? `&space=${space}` : ""}`);
  };
  return (
    <nav className="tools">
      <Link to={homeTo}>Home</Link>
      <button type="button" className="hist" onClick={() => navigate(-1)}>&larr; Back</button>
      <button type="button" className="hist" onClick={() => navigate(1)}>Forward &rarr;</button>
      <span className="spacer" />
      <form className="search" onSubmit={submit} role="search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help" aria-label="Search help" />
      </form>
      <button type="button" className="print" onClick={() => window.print()}>Print</button>
    </nav>
  );
}
