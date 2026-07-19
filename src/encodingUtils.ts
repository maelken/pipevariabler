/**
 * UTF-8 helpers for share/import and repairing mojibake (æøå → Ã¦Ã¸Ã¥).
 */

/** Convert Uint8Array to base64 without call-stack limits on large arrays. */
export const uint8ToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
};

/** Decode base64 to Uint8Array. */
export const base64ToUint8 = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

/**
 * Fix classic UTF-8-as-Latin-1 mojibake, e.g. "smÃ¥" → "små".
 * Only applies when the string looks double-encoded.
 */
export const fixMojibake = (value: string): string => {
    if (!/Ã.|Â./.test(value)) return value;
    try {
        const bytes = Uint8Array.from(value, (c) => c.charCodeAt(0));
        const decoded = new TextDecoder('utf-8').decode(bytes);
        // Prefer decode when it removes mojibake markers
        if (decoded !== value && !/Ã.|Â./.test(decoded)) {
            return decoded;
        }
    } catch {
        // keep original
    }
    return value;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Recursively repair mojibake in all strings of a profile/JSON tree. */
export const repairProfileEncoding = <T,>(data: T): T => {
    const walk = (value: JsonValue): JsonValue => {
        if (typeof value === 'string') return fixMojibake(value);
        if (Array.isArray(value)) return value.map(walk);
        if (value && typeof value === 'object') {
            const out: { [key: string]: JsonValue } = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = walk(v);
            }
            return out;
        }
        return value;
    };
    return walk(data as JsonValue) as T;
};
