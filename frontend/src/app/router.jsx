import { createBrowserRouter, Navigate } from "react-router-dom";

import App from "./App";

import ProductsPage from "../features/products/pages/ProductsPage";

import InventoryPage from "../features/inventory/pages/InventoryPage";

import InventoryDetailPage from "../features/inventory/pages/InventoryDetailPage";

import ScannerPage from "../features/scanner/pages/ScannerPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,

    children: [
      {
        index: true,
        element: <Navigate to="/products" replace />,
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
]);

export default router;
