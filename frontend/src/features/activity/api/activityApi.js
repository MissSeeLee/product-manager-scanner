import { request } from "../../../shared/lib/http";

export async function getActivity(limit = 100) {
  const result = await request(`/api/activity?limit=${encodeURIComponent(limit)}`);
  return result?.data ?? [];
}
