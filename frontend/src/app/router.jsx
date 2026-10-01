import { createBrowserRouter, Outlet } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "../features/auth/AuthProvider";
import { RequireAuth, RequireRole } from "../features/auth/components/RequireAuth";
import RequireCapability from "../features/auth/components/RequireCapability";
import LoginPage from "../features/auth/pages/LoginPage";
import AccountPage from "../features/auth/pages/AccountPage";
import UsersPage from "../features/users/pages/UsersPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import InventoryPage from "../features/inventory/pages/InventoryPage";
import InventoryDetailPage from "../features/inventory/pages/InventoryDetailPage";
import IntakePageV2 from "../features/inventory/pages/IntakePageV2";
import OperationDetailPage from "../features/operations/pages/OperationDetailPage";
import OperationWorkspacePage from "../features/operations/pages/OperationWorkspacePage";
import OperationsPage from "../features/operations/pages/OperationsPage";
import ProjectDetailPage from "../features/projects/pages/ProjectDetailPage";
import ProjectsPageV2 from "../features/management/pages/ProjectsPageV2";
import ProductsPageV2 from "../features/management/pages/ProductsPageV2";
import LocationsPageV2 from "../features/management/pages/LocationsPageV2";
import ActivityPage from "../features/activity/pages/ActivityPage";
import MorePage from "../features/more/pages/MorePage";
import ScannerPage from "../features/scanner/pages/ScannerPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: (
          <RequireAuth>
            <App />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "inventory", element: <InventoryPage /> },
          {
            path: "inventory/intake",
            element: (
              <RequireCapability capability="asset.intake">
                <IntakePageV2 />
              </RequireCapability>
            ),
          },
          { path: "inventory/:id", element: <InventoryDetailPage /> },
          { path: "operations", element: <OperationsPage /> },
          {
            path: "operations/new",
            element: (
              <RequireCapability capability="operations.execute">
                <OperationWorkspacePage />
              </RequireCapability>
            ),
          },
          { path: "operations/:id", element: <OperationDetailPage /> },
          { path: "projects", element: <ProjectsPageV2 /> },
          { path: "projects/:id", element: <ProjectDetailPage /> },
          { path: "products", element: <ProductsPageV2 /> },
          { path: "locations", element: <LocationsPageV2 /> },
          {
            path: "scanner",
            element: (
              <RequireCapability capability="scanner.use">
                <ScannerPage />
              </RequireCapability>
            ),
          },
          { path: "activity", element: <ActivityPage /> },
          { path: "more", element: <MorePage /> },
          { path: "account", element: <AccountPage /> },
          {
            path: "users",
            element: (
              <RequireRole role="ADMIN">
                <UsersPage />
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
]);

export default router;
