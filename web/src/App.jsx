// App.jsx
//
// Routing and the top nav. HashRouter (not BrowserRouter) so the built
// site works on any static host without server-side rewrite rules.

import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Demo from "./pages/Demo.jsx";

export default function App() {
  return (
    <HashRouter>
      <header className="topbar">
        <div className="container topbar-inner">
          <span className="brand">EventFlow</span>
          <nav className="nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/demo">Demo</NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
