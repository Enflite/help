import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useJson } from "../api.js";
import Rich from "../components/Rich.jsx";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const space = params.get("space") || "";
  const { data: hits, loading } = useJson(`/api/search?q=${encodeURIComponent(q)}${space ? `&space=${encodeURIComponent(space)}` : ""}`);
  useEffect(() => {
    document.title = `Search: ${q} | Enflite Help`;
  }, [q]);
  return (
    <article>
      <div className="eyebrow">Search</div>
      <h1 className="plainh1">Results for “{q}”</h1>
      {loading && <p className="meta">Searching…</p>}
      {!loading && hits?.length === 0 && <p>No pages match. Try another word.</p>}
      <dl className="fields">
        {(hits || []).map((h) => (
          <div key={`${h.space}/${h.path}`}>
            <dt><Link to={`/${h.space}/${h.path}`}>{h.number ? `${h.number} ${h.title}` : h.title}</Link></dt>
            <dd><span className="hitmeta">{h.eyebrow}</span> <Rich text={h.summary} /></dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
