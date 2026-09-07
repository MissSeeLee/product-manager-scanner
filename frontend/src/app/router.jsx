import {
  createBrowserRouter,
  Navigate,
} from "react-router-dom"

import App from "./App"
import ProductsPage from "../features/products/pages/ProductsPage"

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: "/",
        element: <Navigate to="/products" replace />,
      },
      {
        path: "/products",
        element: <ProductsPage />,
      },
    ],
  },
])