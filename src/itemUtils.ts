import itemsData from './data.json';
import { Item } from './types';
import { VariablerEntry } from './variablerApi';

interface ItemMetadata {
    image: string;
    variable: string;
}

// Build item data map once for lookups
const itemDataMap = new Map<string, ItemMetadata>();
itemsData.items.forEach((item: { item: string; image: string; variable: string }) => {
    itemDataMap.set(item.item, { image: item.image, variable: item.variable });
});

let remoteItems: VariablerEntry[] | null = null;

const getImageForItem = (itemName: string): string => {
    return itemDataMap.get(itemName)?.image || `${itemName}.png`;
};

/**
 * Opdater variabler fra variabler.maelk.net og merge med lokale billeder.
 */
export const applyVariablerEntries = (entries: VariablerEntry[]): void => {
    remoteItems = entries;

    for (const entry of entries) {
        const existing = itemDataMap.get(entry.item);
        itemDataMap.set(entry.item, {
            image: existing?.image || `${entry.item}.png`,
            variable: entry.variable,
        });
    }
};

/**
 * Process raw items from profile/import, ensuring they have all required fields
 */
export const processItems = (items: Partial<Item>[]): Item[] => items.map((i) => {
    const dataItem = itemDataMap.get(i.item || '');
    return {
        item: i.item || '',
        image: i.image || dataItem?.image || `${i.item}.png`,
        variable: dataItem?.variable || i.variable || '',
        uid: i.uid || Math.random().toString(36).substr(2, 9)
    };
});

/**
 * Get item metadata from the data map
 */
export const getItemData = (itemName: string) => itemDataMap.get(itemName);

/**
 * Get all items, med variabler fra variabler.maelk.net når de er indlæst.
 */
export const getAllItems = (): Item[] => {
    const sourceItems = remoteItems ?? itemsData.items;

    return sourceItems.map((item: { item: string; variable?: string; image?: string }) => ({
        uid: item.item,
        item: item.item,
        image: getImageForItem(item.item),
        variable: itemDataMap.get(item.item)?.variable || item.variable || '',
    }));
};

/**
 * Opdater variabler på eksisterende items efter remote sync.
 */
export const refreshItemVariables = (items: Item[]): Item[] => items.map((item) => {
    const dataItem = itemDataMap.get(item.item);
    if (!dataItem?.variable || dataItem.variable === item.variable) {
        return item;
    }

    return { ...item, variable: dataItem.variable };
});
