import { request } from "../../../shared/lib/http";

export async function getProducts(search = "") {
  const query = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";

  const result = await request(`/api/products${query}`);

  return result?.data ?? [];
}

export async function getProductById(id) {
  const result = await request(`/api/products/${id}`);

  return result?.data ?? null;
}

export async function createProduct(product) {
  return request("/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });
}

export async function updateProduct(id, product) {
  return request(`/api/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });
}
