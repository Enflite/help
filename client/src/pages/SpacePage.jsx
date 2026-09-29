import { useEffect } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useJson } from "../api.js";
import { NotFound } from "./TopicPage.jsx";

// A space's landing page: its description and top-level topics under their groups.
export default function SpacePage() {
  const { space: key } = useParams();
  const { space } = useOutletContext();

  useEffect(() => {
    if (space) document.title = `${space.name} | Enflite Help`;
  }, [space]);

  if (!space) return <SpaceLoading spaceKey={key} />;
  const roots = space.nav.filter((t) => !t.parent);
  const groups = [...new Set(roots.map((r) => r.group || ""))];
  const count = (p) => space.nav.filter((t) => t.parent === p).length;
  return (
    <article>
      <div className="eyebrow">Help library</div>
      <div className="head">
        <div className="badge"><img src="/icons/form.png" alt="" /></div>
        <div>
          <h1>{space.name}</h1>
          <div className="sub">{space.description}</div>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g}>
          <h2>{g || "Topics"}</h2>
          <dl className="fields">
            {roots.filter((r) => (r.group || "") === g).map((r) => (
              <div key={r.path}>
                <dt><Link to={`/${key}/${r.path}`}>{r.title}</Link></dt>
                <dd>{r.summary}{count(r.path) ? <span className="count"> &middot; {count(r.path)} pages</span> : null}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </article>
  );
}

function SpaceLoading({ spaceKey }) {
  const { error } = useJson(`/api/spaces/${spaceKey}`);
  return error ? <NotFound error={error} /> : <p className="meta">Loading…</p>;
}
