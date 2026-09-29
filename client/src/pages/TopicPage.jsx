import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useJson } from "../api.js";
import Blocks from "../components/Blocks.jsx";

export default function TopicPage() {
  const { space, "*": path } = useParams();
  const { data: topic, error, loading } = useJson(`/api/spaces/${space}/topics/${path}`);

  useEffect(() => {
    if (topic) document.title = `${topic.title} | Enflite Help`;
  }, [topic]);

  if (error) return <NotFound error={error} space={space} />;
  if (loading || !topic) return <p className="meta">Loading…</p>;

  const parent = topic.parent && topic.refs[topic.parent];
  const related = [parent, ...topic.related.map((p) => topic.refs[p])].filter(Boolean);
  return (
    <article>
      <div className="eyebrow">{topic.eyebrow}</div>
      <div className="head">
        <div className="badge"><img src={`/icons/${topic.icon || "form"}.png`} alt="" /></div>
        <div>
          <h1>{topic.title}</h1>
          {topic.subtitle && <div className="sub">{topic.subtitle}</div>}
        </div>
      </div>
      <Blocks topic={topic} space={space} />
      {related.length > 0 && (
        <>
          <h2>Related topics</h2>
          <div className="related">
            {related.map((r) => <Link key={r.path} to={`/${space}/${r.path}`}>{r.number ? `${r.number} ${r.title}` : r.title}</Link>)}
          </div>
        </>
      )}
      {parent && topic.group && <p className="meta">{parent.title} &middot; {topic.group}</p>}
    </article>
  );
}

export function NotFound({ error, space }) {
  return (
    <article>
      <div className="eyebrow">Help</div>
      <h1>{error?.status === 404 ? "Page not found" : "Something went wrong"}</h1>
      <p>{error?.status === 404 ? "There is no help page at this address." : error?.message}</p>
      <p><Link to={space ? `/${space}` : "/"}>Back to the help home</Link></p>
    </article>
  );
}
