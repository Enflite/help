import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getJson } from "../api.js";

// Right-click -> Help links (/go/<space>/<form>/<component>, or the same as ?space=&form=&component=)
// are answered by the API with a redirect. If one reaches the client instead, ask the API where it
// goes and replace this page with that one.
export default function GoPage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    getJson(`/api${pathname}${search}`)
      .then(({ path }) => live && navigate(path, { replace: true }))
      .catch(() => live && navigate("/", { replace: true }));
    return () => {
      live = false;
    };
  }, [pathname, search, navigate]);

  return <p className="meta">Opening help…</p>;
}
