// Drag store - item-drag state shared between the drag handlers and the UI
// (chest drags live entirely in solid-dnd's own context)
import { createContext, createSignal, useContext, type JSX } from 'solid-js';
import type { Item } from '../types';

export function createDragStore() {
    const [isDragging, setIsDragging] = createSignal(false);
    const [activeItem, setActiveItem] = createSignal<Item | null>(null);
    /** All items being dragged (multi-select drags carry more than one) */
    const [draggedItems, setDraggedItems] = createSignal<Item[]>([]);
    const [sourceChestId, setSourceChestId] = createSignal<number | null>(null);

    // Insertion placeholder shown while hovering a chest
    const [hoverChestId, setHoverChestId] = createSignal<number | null>(null);
    const [insertionIndex, setInsertionIndex] = createSignal(-1);

    const startDrag = (item: Item, allItems: Item[], chestId: number | null) => {
        setIsDragging(true);
        setActiveItem(item);
        setDraggedItems(allItems);
        setSourceChestId(chestId);
        updatePlaceholder(null, -1);
    };

    const endDrag = () => {
        setIsDragging(false);
        setActiveItem(null);
        setDraggedItems([]);
        setSourceChestId(null);
        updatePlaceholder(null, -1);
    };

    const updatePlaceholder = (chestId: number | null, index: number) => {
        setHoverChestId(chestId);
        setInsertionIndex(index);
    };

    return {
        isDragging,
        activeItem,
        draggedItems,
        sourceChestId,
        hoverChestId,
        insertionIndex,
        startDrag,
        endDrag,
        updatePlaceholder,
    };
}

export type DragStore = ReturnType<typeof createDragStore>;

// ===== Provider & hook =====

const DragContext = createContext<DragStore>();

export function DragProvider(props: { children: JSX.Element }) {
    const store = createDragStore();
    return <DragContext.Provider value={store}>{props.children}</DragContext.Provider>;
}

export function useDrag(): DragStore {
    const context = useContext(DragContext);
    if (!context) throw new Error('useDrag must be used within DragProvider');
    return context;
}

// HMR of a store module recreates the context object and orphans every
// mounted consumer ("useApp must be used within AppProvider") - force a full
// page reload instead when this file changes in dev
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
