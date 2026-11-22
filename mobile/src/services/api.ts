const API_BASE_URL = "https://ytxbnqosenolojifeikf.supabase.co/functions/v1/backoffice";

export type ApiResult<T = Record<string, unknown>> = T & {
  ok?: boolean;
  error?: string;
  code?: string;
};

export async function apiCall<T = Record<string, unknown>>(
  action: string,
  params: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`เชื่อมต่อระบบไม่ได้ (HTTP ${response.status})`);
  const payload = (await response.json()) as ApiResult<T>;
  if (payload.ok === false) throw new Error(payload.error || "ระบบตอบกลับไม่สำเร็จ");
  return payload;
}
