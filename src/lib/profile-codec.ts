// Encode/decode profiles for the "Del Profil (URL)" and "Kopier/Importer Kode" features
import pako from 'pako';
import { getCatalogItem } from './items';
import type { Tab } from '../types';

const SHARE_PARAM = 'p';

// URL-safe base64 (no padding) - keeps share links free of %-escapes
const toBase64Url = (bytes: Uint8Array): string => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64 = (code: string): Uint8Array => {
    const normalized = code.replaceAll('-', '+').replaceAll('_', '/');
    return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
};

/**
 * Shrink a share payload: imports backfill variable/image/uid from the item
 * catalog, so known items only need their name. Unknown items (e.g. renamed
 * in a newer catalog) keep their full data so nothing is lost.
 */
const stripForShare = (tabs: Tab[]) =>
    tabs.map((tab) => ({
        name: tab.name,
        chests: tab.chests.map((chest) => ({
            label: chest.label,
            icon: chest.icon,
            checked: chest.checked,
            items: chest.items.map((item) =>
                getCatalogItem(item.item)
                    ? { item: item.item }
                    : { item: item.item, variable: item.variable, image: item.image },
            ),
        })),
    }));

export const encodeTabs = (tabs: Tab[]): string =>
    toBase64Url(pako.deflate(JSON.stringify({ tabs: stripForShare(tabs) })));

export const decodeTabs = (code: string): Tab[] | null => {
    try {
        const data: unknown = JSON.parse(pako.inflate(fromBase64(code.trim()), { to: 'string' }));
        const tabs = (data as { tabs?: unknown }).tabs;
        return Array.isArray(tabs) ? (tabs as Tab[]) : null;
    } catch {
        return null;
    }
};

export const buildShareUrl = (tabs: Tab[]) =>
    `${location.origin}${location.pathname}?${SHARE_PARAM}=${encodeTabs(tabs)}`;

/**
 * Read a shared profile from the current URL (?p=...) and strip the parameter.
 * Returns null when the URL carries no (valid) shared profile.
 */
export const consumeSharedTabsFromUrl = (): Tab[] | null => {
    const params = new URLSearchParams(location.search);
    const code = params.get(SHARE_PARAM);
    if (!code) return null;

    params.delete(SHARE_PARAM);
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);

    return decodeTabs(code);
};
