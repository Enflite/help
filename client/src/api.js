import { useEffect, useState } from "react";

export async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(res.status === 404 ? "Not found" : `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// { data, error, loading } for a GET url; refetches when the url changes.
export function useJson(url) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getJson(url)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
