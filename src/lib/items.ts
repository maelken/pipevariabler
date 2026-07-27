// Item catalog and item-instance helpers - single source of truth for item business logic
import rawData from '../data.json';
import { CMD_PREFIX } from '../constants';
import type { Item } from '../types';

/** Catalog entry as stored in data.json (no uid - uids belong to instances) */
export interface CatalogItem {
    item: string;
    variable: string;
    image: string;
}

export const ITEM_CATALOG: CatalogItem[] = (rawData as { items: CatalogItem[] }).items;

const catalogByName = new Map(ITEM_CATALOG.map((entry) => [entry.item, entry]));

export const getCatalogItem = (itemName: string) => catalogByName.get(itemName);

/** "oak_planks" -> "oak planks" for display */
export const displayName = (itemName: string) => itemName.replace(/_/g, ' ');

export const generateItemUid = () => crypto.randomUUID();

/** Copy of an item with a fresh uid - used when a sidebar item enters a chest */
export const cloneItemWithNewUid = (item: Item): Item => ({ ...item, uid: generateItemUid() });

/** Sidebar items get deterministic uids so selection survives re-renders */
export const createSidebarItems = (): Item[] =>
    ITEM_CATALOG.map((entry, index) => ({ ...entry, uid: `sidebar-${entry.item}-${index}` }));

/**
 * Normalize raw items from an imported profile or preset.
 * Missing fields are backfilled from the catalog; uids are always regenerated
 * so no two chests can ever share a uid.
 */
export const processItems = (items: Partial<Item>[]): Item[] =>
    items.map((raw) => {
        const catalog = getCatalogItem(raw.item ?? '');
        return {
            item: raw.item ?? '',
            image: raw.image ?? catalog?.image ?? `${raw.item}.png`,
            variable: raw.variable ?? catalog?.variable ?? '',
            uid: generateItemUid(),
        };
    });

/** Drop items whose variable is already present earlier in the list */
export const dedupeByVariable = (items: Item[]): Item[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.variable)) return false;
        seen.add(item.variable);
        return true;
    });
};

/** Build the /signedit command for a chest's items */
export const buildCommand = (items: Item[]) =>
    items.length === 0 ? '' : `${CMD_PREFIX}${items.map((i) => i.variable).join(',')}`;
