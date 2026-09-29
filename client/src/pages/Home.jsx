import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useJson } from "../api.js";

// All spaces (systems) the help covers.
export default function Home() {
  const { data: spaces, error } = useJson("/api/spaces");
  useEffect(() => {
    document.title = "Enflite Help";
  }, []);
  return (
    <article>
      <div className="eyebrow">Enflite</div>
      <div className="head">
        <div className="badge"><img src="/icons/form.png" alt="" /></div>
        <div>
          <h1>Help</h1>
          <div className="sub">How-to, field definitions and procedures for the systems we use.</div>
        </div>
      </div>
      {error && <p>The help library could not be loaded ({error.message}).</p>}
      <dl className="fields">
        {(spaces || []).map((s) => (
          <div key={s.key}>
            <dt><Link to={`/${s.key}`}>{s.name}</Link></dt>
            <dd>{s.description}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
