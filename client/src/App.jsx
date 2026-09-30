import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import GoPage from "./pages/GoPage.jsx";
import Home from "./pages/Home.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import SpacePage from "./pages/SpacePage.jsx";
import TopicPage from "./pages/TopicPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="go/*" element={<GoPage />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<SearchPage />} />
        <Route path=":space" element={<SpacePage />} />
        <Route path=":space/*" element={<TopicPage />} />
      </Route>
    </Routes>
  );
}
