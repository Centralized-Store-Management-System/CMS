const API_BASE_URL = "https://ytxbnqosenolojifeikf.supabase.co/functions/v1/backoffice";

export type ApiResult<T = Record<string, unknown>> = T & {
  ok?: boolean;
  error?: string;
  code?: string;
};

function parseJsonp<T>(raw: string): ApiResult<T> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("(");
  const end = trimmed.lastIndexOf(")");
  const json = start >= 0 && end > start ? trimmed.slice(start + 1, end) : trimmed;
  let envelope: any;
  try {
    envelope = JSON.parse(json);
  } catch {
    throw new Error("รูปแบบข้อมูลจากระบบไม่ถูกต้อง");
  }
  if (!envelope || typeof envelope !== "object") throw new Error("เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ");
  if (envelope.ok === false) {
    const error = new Error(envelope.error || "ระบบตอบกลับไม่สำเร็จ") as Error & { code?: string };
    error.code = envelope.code;
    throw error;
  }
  // CMS API.call() resolves the JSONP envelope's data property.
  return (Object.prototype.hasOwnProperty.call(envelope, "data") ? envelope.data : envelope) as ApiResult<T>;
}

/**
 * Native transport compatible with the existing CMS JSONP contract.
 * Browser CORS rules do not apply to React Native networking, but the
 * callback envelope is retained so the same backend contract is used.
 */
export async function apiCall<T = Record<string, unknown>>(
  action: string,
  params: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("callback", "__nativeApiCallback");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/javascript, application/json, text/plain" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`เชื่อมต่อระบบไม่ได้ (HTTP ${response.status})`);
    return parseJsonp<T>(await response.text());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("เซิร์ฟเวอร์ไม่ตอบกลับภายใน 30 วินาที กรุณาลองใหม่");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
