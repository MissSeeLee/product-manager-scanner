import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/authContext";

const desktopNavigation = [
  {
    label: "งานประจำวัน",
    items: [
      { to: "/", end: true, label: "ภาพรวม", icon: "dashboard" },
      { to: "/inventory", label: "อุปกรณ์", icon: "assets" },
      { to: "/operations", label: "เบิก / คืน", icon: "operations" },
      { to: "/projects", label: "โครงการ / งาน", icon: "projects" },
      { to: "/scanner", label: "สแกน", icon: "scan", roles: ["ADMIN", "OPERATOR"] },
    ],
  },
  {
    label: "ข้อมูลหลัก",
    items: [
      { to: "/products", label: "รุ่นสินค้า", icon: "models" },
      { to: "/locations", label: "สถานที่", icon: "locations" },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { to: "/users", label: "ผู้ใช้และสิทธิ์", icon: "users", roles: ["ADMIN"] },
      { to: "/account", label: "บัญชีของฉัน", icon: "account" },
    ],
  },
];

const mobileNavigation = [
  { to: "/", end: true, label: "ภาพรวม", icon: "dashboard" },
  { to: "/inventory", label: "อุปกรณ์", icon: "assets" },
  { to: "/operations", label: "เบิก/คืน", icon: "operations" },
  { to: "/scanner", label: "สแกน", icon: "scan", roles: ["ADMIN", "OPERATOR"] },
];

const pageTitles = [
  { match: /^\/$/, title: "ภาพรวมระบบ" },
  { match: /^\/inventory\/[^/]+$/, title: "รายละเอียดอุปกรณ์" },
  { match: /^\/inventory/, title: "อุปกรณ์" },
  { match: /^\/operations\/new/, title: "ทำรายการหลายอุปกรณ์" },
  { match: /^\/operations\/[^/]+$/, title: "รายละเอียดการทำรายการ" },
  { match: /^\/operations/, title: "เบิก / คืน" },
  { match: /^\/projects\/[^/]+$/, title: "รายละเอียดโครงการ" },
  { match: /^\/projects/, title: "โครงการ / งาน" },
  { match: /^\/products/, title: "รุ่นสินค้า" },
  { match: /^\/locations/, title: "สถานที่" },
  { match: /^\/scanner/, title: "สแกนอุปกรณ์" },
  { match: /^\/users/, title: "ผู้ใช้และสิทธิ์" },
  { match: /^\/account/, title: "บัญชีของฉัน" },
];

const roleLabels = {
  ADMIN: "Admin",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="4" rx="1.5" />
        <rect x="14" y="11" width="7" height="10" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "assets") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10" />
        <path d="M7 13h6" />
        <path d="M17 13h.01" />
      </svg>
    );
  }

  if (name === "operations") {
    return (
      <svg {...common}>
        <path d="M5 7h11" />
        <path d="m13 4 3 3-3 3" />
        <path d="M19 17H8" />
        <path d="m11 14-3 3 3 3" />
      </svg>
    );
  }

  if (name === "projects") {
    return (
      <svg {...common}>
        <path d="M4 7.5h6l1.7 2H20v9.5H4z" />
        <path d="M4 7.5V5h6l1.5 2" />
      </svg>
    );
  }

  if (name === "models") {
    return (
      <svg {...common}>
        <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
        <path d="m3.5 12 8.5 4.5 8.5-4.5" />
        <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
      </svg>
    );
  }

  if (name === "locations") {
    return (
      <svg {...common}>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.7-3.6 2.5-5.5 5.5-5.5s4.8 1.9 5.5 5.5" />
        <path d="M16 6.5a2.5 2.5 0 0 1 0 5" />
        <path d="M17 14c2 .5 3.2 2.2 3.5 5" />
      </svg>
    );
  }

  if (name === "account") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-4.3 3.1-6.5 7-6.5s6.2 2.2 7 6.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 7V4h3" />
      <path d="M17 4h3v3" />
      <path d="M20 17v3h-3" />
      <path d="M7 20H4v-3" />
      <path d="M7 9v6" />
      <path d="M10 9v6" />
      <path d="M14 9v6" />
      <path d="M17 9v6" />
    </svg>
  );
}

function getPageTitle(pathname) {
  return (
    pageTitles.find((item) => item.match.test(pathname))?.title ??
    "Asset Operations"
  );
}

function canSee(item, role) {
  return !item.roles || item.roles.includes(role);
}

function NavigationLink({ item, mobile = false }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => {
        if (mobile) {
          return isActive
            ? `mobile-nav-link active ${item.icon === "scan" ? "mobile-nav-scan" : ""}`
            : `mobile-nav-link ${item.icon === "scan" ? "mobile-nav-scan" : ""}`;
        }

        return isActive ? "nav-link active" : "nav-link";
      }}
    >
      <span className={mobile ? "mobile-nav-icon" : "nav-icon"}>
        <Icon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </NavLink>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pageTitle = getPageTitle(location.pathname);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/askme-logo.png"
            alt="AskMe Solutions & Consultants Co., Ltd."
          />
          <div className="brand-mark" aria-hidden="true">AO</div>
          <div className="brand-copy">
            <p className="brand-title">AssetOps</p>
            <p className="brand-subtitle">IT Asset Operations</p>
          </div>
        </div>

        <nav className="nav" aria-label="เมนูหลัก">
          {desktopNavigation.map((group) => {
            const items = group.items.filter((item) => canSee(item, user?.role));
            if (items.length === 0) return null;

            return (
              <div key={group.label} className="nav-group">
                <span className="nav-section-label">{group.label}</span>
                {items.map((item) => (
                  <NavigationLink key={item.to} item={item} />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer auth-sidebar-footer">
          <span className="system-indicator" aria-hidden="true" />
          <div>
            <strong>{user?.displayName}</strong>
            <span>{roleLabels[user?.role] || user?.role}</span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="topbar-eyebrow">Asset Operations</span>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            {location.pathname !== "/scanner" && user?.role !== "VIEWER" && (
              <NavLink to="/scanner" className="button button-primary topbar-scan">
                <Icon name="scan" />
                <span>สแกนอุปกรณ์</span>
              </NavLink>
            )}

            <NavLink to="/account" className="user-chip" title="บัญชีของฉัน">
              <span className="user-chip-avatar">{(user?.displayName || user?.username || "U").slice(0, 1).toUpperCase()}</span>
              <span className="user-chip-copy">
                <strong>{user?.displayName}</strong>
                <small>{roleLabels[user?.role] || user?.role}</small>
              </span>
            </NavLink>

            <button type="button" className="button button-secondary logout-button" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        </header>

        {user?.role === "VIEWER" && (
          <div className="read-only-banner">บัญชี Viewer: สามารถดูข้อมูล Manager ได้ แต่ไม่มีสิทธิ์แก้ไขข้อมูลหรือทำรายการ</div>
        )}

        <div className="page-container">
          <Outlet />
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">
        {mobileNavigation
          .filter((item) => canSee(item, user?.role))
          .map((item) => (
            <NavigationLink key={item.to} item={item} mobile />
          ))}
      </nav>
    </div>
  );
}

export default App;
