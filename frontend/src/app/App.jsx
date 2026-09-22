import { NavLink, Outlet, useLocation } from "react-router-dom"

const navigation = [
  {
    to: "/",
    end: true,
    label: "ภาพรวม",
    shortLabel: "ภาพรวม",
    icon: "dashboard",
  },
  {
    to: "/inventory",
    label: "อุปกรณ์",
    shortLabel: "อุปกรณ์",
    icon: "assets",
  },
  {
    to: "/products",
    label: "รุ่นสินค้า",
    shortLabel: "รุ่น",
    icon: "models",
  },
  {
    to: "/scanner",
    label: "สแกน",
    shortLabel: "สแกน",
    icon: "scan",
  },
]

const pageTitles = [
  { match: /^\/$/, title: "ภาพรวมระบบ" },
  { match: /^\/inventory\/[^/]+$/, title: "รายละเอียดอุปกรณ์" },
  { match: /^\/inventory/, title: "อุปกรณ์" },
  { match: /^\/products/, title: "รุ่นสินค้า" },
  { match: /^\/scanner/, title: "สแกนอุปกรณ์" },
]

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
  }

  if (name === "dashboard") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="4" rx="1.5" />
        <rect x="14" y="11" width="7" height="10" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  }

  if (name === "assets") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10" />
        <path d="M7 13h6" />
        <path d="M17 13h.01" />
      </svg>
    )
  }

  if (name === "models") {
    return (
      <svg {...common}>
        <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z" />
        <path d="m3.5 12 8.5 4.5 8.5-4.5" />
        <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
      </svg>
    )
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
  )
}

function getPageTitle(pathname) {
  return (
    pageTitles.find((item) => item.match.test(pathname))?.title ??
    "Asset Operations"
  )
}

function App() {
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            AO
          </div>

          <div className="brand-copy">
            <p className="brand-title">AssetOps</p>
            <p className="brand-subtitle">IT Asset Operations</p>
          </div>
        </div>

        <nav className="nav" aria-label="เมนูหลัก">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">
                <Icon name={item.icon} />
              </span>

              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="system-indicator" aria-hidden="true" />
          <div>
            <strong>ระบบพร้อมใช้งาน</strong>
            <span>Local asset database</span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div className="topbar-copy">
            <span className="topbar-eyebrow">Asset Operations</span>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>

          {location.pathname !== "/scanner" && (
            <NavLink to="/scanner" className="button button-primary topbar-scan">
              <Icon name="scan" />
              <span>สแกนอุปกรณ์</span>
            </NavLink>
          )}
        </header>

        <div className="page-container">
          <Outlet />
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive
                ? `mobile-nav-link active ${
                    item.icon === "scan" ? "mobile-nav-scan" : ""
                  }`
                : `mobile-nav-link ${
                    item.icon === "scan" ? "mobile-nav-scan" : ""
                  }`
            }
          >
            <span className="mobile-nav-icon">
              <Icon name={item.icon} />
            </span>
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default App
