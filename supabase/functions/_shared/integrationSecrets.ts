// Shared helpers to store and read per-restaurant integration secrets,
// encrypted at rest with AES-GCM using INTEGRATION_SECRETS_KEY.
//
// The DB column stores raw ciphertext + iv. Only edge functions running with
// the service role and the master key can decrypt.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getMasterKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("INTEGRATION_SECRETS_KEY");
  if (!raw) throw new Error("INTEGRATION_SECRETS_KEY not configured");
  // Derive a 256-bit key from the master string via SHA-256.
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return { ciphertext: new Uint8Array(ct), iv };
}

export async function decryptSecret(
  ciphertext: Uint8Array,
  iv: Uint8Array,
): Promise<string> {
  const key = await getMasterKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(pt);
}

// Postgres bytea comes back as either a hex string ("\\xabcd...") or a
// base64 string depending on driver. Supabase-js returns "\\x..." hex.
export function pgByteaToUint8(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (typeof v === "string") {
    if (v.startsWith("\\x")) {
      const hex = v.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
      return out;
    }
    // fall back to base64
    return Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
  }
  throw new Error("Unsupported bytea format");
}

// Encode Uint8Array as Postgres bytea hex literal so supabase-js sends it correctly.
export function uint8ToPgBytea(u: Uint8Array): string {
  let hex = "\\x";
  for (const b of u) hex += b.toString(16).padStart(2, "0");
  return hex;
}
