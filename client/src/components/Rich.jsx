import { Link } from "react-router-dom";

// Inline markup used in content/: **bold** and [label](href). Links starting with "/" stay in
// the app, except /files/ (documents), which open as files.
const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export default function Rich({ text }) {
  const s = String(text ?? "");
  const out = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const key = m.index;
    if (m[1] !== undefined) out.push(<b key={key}>{m[1]}</b>);
    else if (m[3].startsWith("/") && !m[3].startsWith("/files/")) out.push(<Link key={key} to={m[3]}>{m[2]}</Link>);
    else out.push(<a key={key} href={m[3]} target="_blank" rel="noreferrer">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return <>{out}</>;
}
