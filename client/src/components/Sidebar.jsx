import { Link } from "react-router-dom";

// Roots (topics without a parent) under their group label. Only the root you are in expands:
// its children under collapsible sections, in the order of the root's `groups` (a flat list
// when it has one group). The section holding the current page is open and the page is marked.
export default function Sidebar({ space, currentPath }) {
  const nav = space.nav;
  const roots = nav.filter((t) => !t.parent);
  const kids = (p) => nav.filter((t) => t.parent === p);
  const labels = [...new Set(roots.map((r) => r.group || ""))]; // in root order (the API sorts by order)
  const href = (t) => `/${space.key}/${t.path}`;
  const cls = (t) => (t.path === currentPath ? "cur" : undefined);

  return (
    <aside>
      {labels.map((heading) => (
        <div key={heading} className="navgroup">
          {heading && <div className="eyebrow">{heading}</div>}
          {roots.filter((r) => (r.group || "") === heading).map((root) => {
            const children = kids(root.path);
            const groups = root.groups?.length ? root.groups : [...new Set(children.map((c) => c.group || ""))];
            const inRoot = currentPath === root.path || currentPath.startsWith(`${root.path}/`);
            return (
              <div key={root.path}>
                <ul><li><Link className={["top", cls(root)].filter(Boolean).join(" ")} to={href(root)}>{root.title}</Link></li></ul>
                {groups.length <= 1 ? inRoot && (
                  <ul>{children.map((c) => <li key={c.path}><Link className={cls(c)} to={href(c)}>{label(c)}</Link></li>)}</ul>
                ) : (
                  inRoot && groups.map((g) => {
                    const items = children.filter((c) => (c.group || "") === g);
                    if (!items.length) return null;
                    const open = inRoot && items.some((c) => c.path === currentPath);
                    return (
                      <details key={g} open={open || undefined}>
                        <summary>{g}</summary>
                        <ul>{items.map((c) => <li key={c.path}><Link className={cls(c)} to={href(c)}>{label(c)}</Link></li>)}</ul>
                      </details>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

function label(t) {
  return t.number ? `${t.number} ${t.title}` : t.title;
}
