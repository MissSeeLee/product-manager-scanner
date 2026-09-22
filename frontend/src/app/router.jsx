import { createBrowserRouter } from "react-router-dom"

import App from "./App"

import DashboardPage from "../features/dashboard/pages/DashboardPage"
import ProductsPage from "../features/products/pages/ProductsPage"
import InventoryPage from "../features/inventory/pages/InventoryPage"
import InventoryDetailPage from "../features/inventory/pages/InventoryDetailPage"
import ScannerPage from "../features/scanner/pages/ScannerPage"

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "products",
        element: <ProductsPage />,
      },
      {
        path: "inventory",
        element: <InventoryPage />,
      },
      {
        path: "inventory/:id",
        element: <InventoryDetailPage />,
      },
      {
        path: "scanner",
        element: <ScannerPage />,
      },
    ],
  },
])

export default router
