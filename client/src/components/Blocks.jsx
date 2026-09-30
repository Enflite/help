import { useState } from "react";
import { Link } from "react-router-dom";
import Flowchart from "./Flowchart.jsx";
import Rich from "./Rich.jsx";

// Renders a topic's body. Block types are documented in content/README.md.
export default function Blocks({ topic, space }) {
  return topic.blocks.map((b, i) => <Block key={i} b={b} topic={topic} space={space} />);
}

const title = (t) => (t.number ? `${t.number} ${t.title}` : t.title);

function Block({ b, topic, space }) {
  switch (b.t) {
    case "p":
      return <p><Rich text={b.text} /></p>;
    case "h2":
      return <h2><Rich text={b.text} /></h2>;
    case "h3":
      return <h3><Rich text={b.text} /></h3>;
    case "list":
      return <ul className="sq">{b.items.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ul>;
    case "steps":
      return <ol className="steps">{b.items.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ol>;
    case "table":
      return (
        <div className="tablewrap">
          <table className={b.align === "left" ? "left" : undefined}>
            {b.head && <thead><tr>{b.head.map((h, i) => <th key={i}><Rich text={h} /></th>)}</tr></thead>}
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Rich text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "children":
      return <Children topic={topic} space={space} />;
    case "links":
      return (
        <>
          {b.title && <h2>{b.title}</h2>}
          <dl className="fields">
            {b.items.map((p) => topic.refs[p] && (
              <div key={p}>
                <dt><Link to={`/${space}/${p}`}>{title(topic.refs[p])}</Link></dt>
                <dd><Rich text={topic.refs[p].summary} /></dd>
              </div>
            ))}
          </dl>
        </>
      );
    case "meta":
      return <dl className="doc">{b.items.map(([k, v]) => [<dt key={`${k}t`}>{k}</dt>, <dd key={`${k}d`}><Rich text={v} /></dd>])}</dl>;
    case "notice":
      return <p className="notice"><Rich text={b.text} /></p>;
    case "legend":
      return <p className="legend"><i /><Rich text={b.text} /></p>;
    case "pstep":
      return <Step b={b} />;
    case "flowchart":
      return <Flowchart name={b.name} />;
    case "note":
      return (
        <div className={`callout ${b.kind || "note"}`}>
          <span className="lbl">{b.kind === "warning" ? "Warning" : "Note"}</span>
          <Rich text={b.text} />
        </div>
      );
    case "faq":
      return (
        <div className="faq">
          {b.items.map(([q, a], i) => (
            <details key={i}>
              <summary><Rich text={q} /></summary>
              <p><Rich text={a} /></p>
            </details>
          ))}
        </div>
      );
    case "code":
      return <Code b={b} />;
    case "endpoint":
      return (
        <div className="endpoint">
          <span className={`method ${String(b.method).toLowerCase()}`}>{b.method}</span>
          <code>{b.path}</code>
          {b.text && <div className="etext"><Rich text={b.text} /></div>}
        </div>
      );
    default:
      return null;
  }
}

// A topic's child pages, under its groups (e.g. the form's sections with their fields).
function Children({ topic, space }) {
  const groups = topic.groups?.length ? topic.groups : [...new Set(topic.children.map((c) => c.group || ""))];
  return groups.map((g) => {
    const items = topic.children.filter((c) => (c.group || "") === g);
    if (!items.length) return null;
    return (
      <section key={g}>
        {g && groups.length > 1 && <h2>{g}</h2>}
        <dl className="fields">
          {items.map((c) => (
            <div key={c.path}>
              <dt><Link to={`/${space}/${c.path}`}>{title(c)}</Link></dt>
              <dd><Rich text={c.summary} /></dd>
            </div>
          ))}
        </dl>
      </section>
    );
  });
}

// A numbered procedure step (or definition). Changed / removed / added steps sit on a thin red
// rule, with the released wording ("Rev was") and the reason.
function Step({ b }) {
  const level = Math.min((b.num.replace(/\.$/, "").match(/\./g) || []).length, 4);
  const cls = ["step", `l${level}`, b.kind].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="n">{b.num}</span>
      <div>
        {b.kind && <span className="tag">{b.kind}</span>}
        {b.text && <Rich text={b.text} />}
        {b.was && (
          <span className="was"><span className="lbl">Rev was</span>{b.kind === "removed" ? <s>{b.was}</s> : b.was}</span>
        )}
        {b.why && <span className="why"><span className="lbl">Why</span>{b.why}</span>}
      </div>
    </div>
  );
}

// A code sample (script, request, response) with a Copy button.
function Code({ b }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(b.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => {});
  };
  return (
    <div className="code">
      <div className="codehead">
        <span>{b.title || b.lang || "Code"}</span>
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre><code>{b.text}</code></pre>
    </div>
  );
}
