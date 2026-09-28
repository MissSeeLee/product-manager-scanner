import { createBrowserRouter, Outlet } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "../features/auth/AuthProvider";
import { RequireAuth, RequireRole } from "../features/auth/components/RequireAuth";
import LoginPage from "../features/auth/pages/LoginPage";
import AccountPage from "../features/auth/pages/AccountPage";
import UsersPage from "../features/users/pages/UsersPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import InventoryPage from "../features/inventory/pages/InventoryPage";
import InventoryDetailPage from "../features/inventory/pages/InventoryDetailPage";
import LocationsPage from "../features/locations/pages/LocationsPage";
import OperationDetailPage from "../features/operations/pages/OperationDetailPage";
import OperationWorkspacePage from "../features/operations/pages/OperationWorkspacePage";
import OperationsPage from "../features/operations/pages/OperationsPage";
import ProductsPage from "../features/products/pages/ProductsPage";
import ProjectDetailPage from "../features/projects/pages/ProjectDetailPage";
import ProjectsPage from "../features/projects/pages/ProjectsPage";
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
          { path: "inventory/:id", element: <InventoryDetailPage /> },
          { path: "operations", element: <OperationsPage /> },
          { path: "operations/new", element: <OperationWorkspacePage /> },
          { path: "operations/:id", element: <OperationDetailPage /> },
          { path: "projects", element: <ProjectsPage /> },
          { path: "projects/:id", element: <ProjectDetailPage /> },
          { path: "products", element: <ProductsPage /> },
          { path: "locations", element: <LocationsPage /> },
          { path: "scanner", element: <ScannerPage /> },
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
