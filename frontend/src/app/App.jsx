import { NavLink, Outlet } from "react-router-dom";

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1 className="brand-title">Asset Manager</h1>

          <p className="brand-subtitle">Inventory Management</p>
        </div>

        <nav className="nav">
          <NavLink
            to="/products"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            สินค้า
          </NavLink>
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <p className="topbar-title">Product & Inventory Management</p>
        </header>

        <div className="page-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default App;
