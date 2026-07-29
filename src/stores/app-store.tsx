// App store - central state management
import { createContext, createEffect, createSignal, useContext, type JSX } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import { CHEST_ROW_HEIGHT, MAX_PROFILE_BACKUPS, MAX_UNDO_STEPS, STORAGE_KEYS } from '../constants';
import { createSidebarItems, dedupeByVariable, displayName, processItems } from '../lib/items';
import { consumeSharedTabsFromUrl } from '../lib/profile-codec';
import type { Chest, ChestHeight, Item, Tab } from '../types';

export type AppState = {
    /** The full item catalog shown in the sidebar */
    items: Item[];
    tabs: Tab[];
    activeTabId: number;
    /** Selected item uids (sidebar and chest items share one selection) */
    selectedItems: Set<string>;
    /** Sidebar search term - shared so chests can highlight matches */
    searchTerm: string;
    /** When on, chests containing search matches get a highlight ring */
    highlightChestMatches: boolean;
    chestGridView: boolean;
    sidebarGridView: boolean;
    chestHeight: ChestHeight;
    deleteChestModalVisible: boolean;
    chestToDelete: number | null;
    newProfileModalVisible: boolean;
    undoStack: Tab[][];
    redoStack: Tab[][];
};

// ===== Ingestion =====

type RawChest = Partial<Omit<Chest, 'items'>> & { items?: Partial<Item>[] };
type RawTab = Partial<Omit<Tab, 'chests'>> & { chests?: RawChest[] };

/**
 * Single hardened ingestion point for tabs from localStorage, imports,
 * presets and shared URLs. Re-sequences tab/chest ids from 1 so duplicate or
 * missing ids can never enter the store, and regenerates every item uid so no
 * two chests can share one.
 */
const normalizeTabs = (rawTabs: RawTab[]): Tab[] => {
    let chestId = 1;
    return rawTabs.map((tab, tabIndex) => ({
        id: tabIndex + 1,
        name: tab.name || `Tab ${tabIndex + 1}`,
        chests: (tab.chests ?? []).map((chest) => ({
            id: chestId++,
            label: chest.label || 'Barrel',
            icon: (chest.icon || 'barrel').replace('.png', ''),
            checked: chest.checked ?? false,
            items: processItems(chest.items ?? []),
        })),
    }));
};

const DEFAULT_TABS: RawTab[] = [{ name: 'Default', chests: [] }];

const loadInitialTabs = (): Tab[] => {
    // A shared profile in the URL (?p=...) wins over the locally saved state
    const sharedTabs = consumeSharedTabsFromUrl();
    if (sharedTabs) return normalizeTabs(sharedTabs);

    try {
        const saved = localStorage.getItem(STORAGE_KEYS.tabs);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (Array.isArray(parsed) && parsed.length > 0) return normalizeTabs(parsed);
    } catch {
        // Corrupt saved state - fall through to the default
    }
    return normalizeTabs(DEFAULT_TABS);
};

const createInitialState = (): AppState => {
    const tabs = loadInitialTabs();
    return {
        items: createSidebarItems(),
        tabs,
        activeTabId: tabs[0].id,
        selectedItems: new Set<string>(),
        searchTerm: '',
        highlightChestMatches: false,
        chestGridView: localStorage.getItem(STORAGE_KEYS.chestGridView) === 'true',
        sidebarGridView: localStorage.getItem(STORAGE_KEYS.sidebarGridView) === 'true',
        chestHeight: ((saved) => (saved && saved in CHEST_ROW_HEIGHT ? saved as ChestHeight : 'medium'))(
            localStorage.getItem(STORAGE_KEYS.chestHeight),
        ),
        deleteChestModalVisible: false,
        chestToDelete: null,
        newProfileModalVisible: false,
        undoStack: [],
        redoStack: [],
    };
};

// ===== Backups =====

export type ProfileBackup = { timestampMs: number; tabs: Tab[] };

/**
 * Content fingerprint that ignores item uids - they are regenerated on every
 * load, so raw JSON comparison would see every session as "changed" and fill
 * the backup list with identical entries.
 */
const backupFingerprint = (tabs: Tab[]) => JSON.stringify(tabs.map((tab) => ({
    n: tab.name,
    c: tab.chests.map((chest) => ({
        l: chest.label, i: chest.icon, k: chest.checked,
        it: chest.items.map((item) => item.item),
    })),
})));

const readBackups = (): ProfileBackup[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.backups);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        const backups = Array.isArray(parsed) ? (parsed as ProfileBackup[]) : [];
        // Collapse runs of identical backups (from before fingerprint dedupe)
        const deduped = backups.filter((b, i) =>
            i === 0 || backupFingerprint(b.tabs) !== backupFingerprint(backups[i - 1].tabs));
        if (deduped.length !== backups.length) {
            localStorage.setItem(STORAGE_KEYS.backups, JSON.stringify(deduped));
        }
        return deduped;
    } catch {
        return [];
    }
};

// ===== Store =====

export function createAppStore() {
    const [state, setState] = createStore<AppState>(createInitialState());
    const [backups, setBackups] = createSignal<ProfileBackup[]>(readBackups());

    // ----- Derived -----
    const activeTab = () => state.tabs.find((t) => t.id === state.activeTabId);
    const chests = () => activeTab()?.chests ?? [];

    // ----- Internal helpers -----
    const snapshotTabs = (): Tab[] => structuredClone(unwrap(state.tabs));

    const pushUndoRaw = (tabs: Tab[]) => {
        setState('undoStack', (stack) => [...stack.slice(-(MAX_UNDO_STEPS - 1)), tabs]);
        setState('redoStack', []);
    };

    // Undo batching: a drag fires many store actions (live tab reorder, dwell
    // tab-switch, the drop itself) but must be ONE undo step. While a batch is
    // open, individual pushUndo calls are suppressed; the batch pushes the
    // pre-drag snapshot once at the end, only if something actually changed.
    let undoBatchDepth = 0;
    let undoBatchSnapshot: Tab[] | null = null;
    const beginUndoBatch = () => {
        if (undoBatchDepth++ === 0) undoBatchSnapshot = snapshotTabs();
    };
    const endUndoBatch = () => {
        if (--undoBatchDepth > 0) return;
        const snapshot = undoBatchSnapshot;
        undoBatchSnapshot = null;
        if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(unwrap(state.tabs))) {
            pushUndoRaw(snapshot);
        }
    };

    /** Record the current (or a pre-captured) tabs state as an undo step */
    const pushUndo = (tabs: Tab[] = snapshotTabs()) => {
        if (undoBatchDepth > 0) return; // the open batch owns the undo step
        pushUndoRaw(tabs);
    };

    /** Chests have globally unique ids, so a chest can be found across all tabs */
    const findChestPath = (chestId: number): { tabIndex: number; chestIndex: number } | null => {
        for (let tabIndex = 0; tabIndex < state.tabs.length; tabIndex++) {
            const chestIndex = state.tabs[tabIndex].chests.findIndex((c) => c.id === chestId);
            if (chestIndex !== -1) return { tabIndex, chestIndex };
        }
        return null;
    };

    const activeTabIndex = () => state.tabs.findIndex((t) => t.id === state.activeTabId);

    /** Keep activeTabId valid after undo/redo/replace */
    const ensureValidActiveTab = () => {
        if (!state.tabs.some((t) => t.id === state.activeTabId)) {
            setState('activeTabId', state.tabs[0]?.id ?? 1);
        }
    };

    // ----- Tab actions -----
    const setActiveTabId = (tabId: number) => setState('activeTabId', tabId);

    const addTab = () => {
        const newId = Math.max(...state.tabs.map((t) => t.id), 0) + 1;
        pushUndo();
        setState('tabs', produce((tabs) => tabs.push({ id: newId, name: `Tab ${newId}`, chests: [] })));
        setActiveTabId(newId);
    };

    const removeTab = (tabId: number) => {
        if (state.tabs.length <= 1) return;
        pushUndo();
        setState('tabs', (tabs) => tabs.filter((t) => t.id !== tabId));
        ensureValidActiveTab();
    };

    const renameTab = (tabId: number, name: string) => {
        setState('tabs', (t) => t.id === tabId, 'name', name);
    };

    const moveTab = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        pushUndo();
        setState('tabs', produce((tabs) => {
            const [moved] = tabs.splice(fromIndex, 1);
            tabs.splice(toIndex, 0, moved);
        }));
    };

    // ----- Chest actions -----
    const addChest = (chest: Chest) => {
        const tabIndex = activeTabIndex();
        if (tabIndex === -1) return;
        pushUndo();
        setState('tabs', tabIndex, 'chests', produce((chests) => chests.push(chest)));
    };

    const moveChest = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        const tabIndex = activeTabIndex();
        if (tabIndex === -1) return;
        pushUndo();
        setState('tabs', tabIndex, 'chests', produce((chests) => {
            const [moved] = chests.splice(fromIndex, 1);
            chests.splice(toIndex, 0, moved);
        }));
    };

    const moveChestToTab = (chestId: number, targetTabId: number) => {
        const path = findChestPath(chestId);
        const targetTabIndex = state.tabs.findIndex((t) => t.id === targetTabId);
        if (!path || targetTabIndex === -1 || path.tabIndex === targetTabIndex) return;

        pushUndo();
        const chest = unwrap(state.tabs[path.tabIndex].chests[path.chestIndex]);
        setState('tabs', path.tabIndex, 'chests', (chests) => chests.filter((c) => c.id !== chestId));
        setState('tabs', targetTabIndex, 'chests', produce((chests) => chests.push(chest)));
        setActiveTabId(targetTabId);
    };

    /** Shallow-merge a patch into one chest (label, icon, checked, ...) */
    const updateChest = (chestId: number, patch: Partial<Chest>) => {
        const path = findChestPath(chestId);
        if (!path) return;
        pushUndo();
        setState('tabs', path.tabIndex, 'chests', path.chestIndex, patch);
    };

    const getNextChestId = (): number => {
        const allChests = state.tabs.flatMap((t) => t.chests);
        return Math.max(...allChests.map((c) => c.id), 0) + 1;
    };

    // Delete chest - ask for confirmation when it still holds items
    // (skipConfirm, e.g. via Shift-click, bypasses the modal)
    const deleteChest = (chestId: number, skipConfirm = false) => {
        const path = findChestPath(chestId);
        if (!path) return;
        if (!skipConfirm && state.tabs[path.tabIndex].chests[path.chestIndex].items.length > 0) {
            setState({ chestToDelete: chestId, deleteChestModalVisible: true });
        } else {
            removeChestDirect(chestId);
        }
    };

    const removeChestDirect = (chestId: number) => {
        const path = findChestPath(chestId);
        if (!path) return;
        pushUndo();
        setState('tabs', path.tabIndex, 'chests', (chests) => chests.filter((c) => c.id !== chestId));
    };

    const confirmDeleteChest = () => {
        if (state.chestToDelete !== null) removeChestDirect(state.chestToDelete);
        setState({ deleteChestModalVisible: false, chestToDelete: null });
    };

    const cancelDeleteChest = () => {
        setState({ deleteChestModalVisible: false, chestToDelete: null });
    };

    // ----- Chest item actions (all atomic: one undo step each) -----

    /** Remove the given uids from every chest they live in (multi-select can span chests) */
    const removeUidsFromAllChests = (uids: Set<string>) => {
        setState('tabs', produce((tabs) => {
            for (const tab of tabs) {
                for (const chest of tab.chests) {
                    if (chest.items.some((item) => uids.has(item.uid))) {
                        chest.items = chest.items.filter((item) => !uids.has(item.uid));
                    }
                }
            }
        }));
    };

    /**
     * Move items into a chest. Chest items are removed from wherever they came
     * from (a multi-select can span several chests); sidebar clones exist
     * nowhere and are just added. Items whose variable already sits in the
     * target (and isn't itself part of the drag) are rejected up front - a
     * rejected item is NEVER removed from its source, so a "duplicate" drop
     * can't silently delete anything.
     */
    const moveItemsToChest = (options: {
        items: Item[];
        targetChestId: number;
        /** Insert before this item - resolved AFTER source removal so the position matches the drop preview */
        insertBeforeUid?: string;
    }) => {
        const { items, targetChestId, insertBeforeUid } = options;
        const targetPath = findChestPath(targetChestId);
        if (!targetPath || items.length === 0) return;

        const draggedUids = new Set(items.map((i) => i.uid));
        const targetChest = state.tabs[targetPath.tabIndex].chests[targetPath.chestIndex];
        const existingVariables = new Set(
            targetChest.items.filter((i) => !draggedUids.has(i.uid)).map((i) => i.variable),
        );
        const accepted = items.filter((item) => {
            if (existingVariables.has(item.variable)) return false;
            existingVariables.add(item.variable);
            return true;
        });
        if (accepted.length === 0) return;

        pushUndo();
        removeUidsFromAllChests(new Set(accepted.map((i) => i.uid)));

        setState('tabs', targetPath.tabIndex, 'chests', targetPath.chestIndex, 'items', (current) => {
            const result = [...current];
            const targetIndex = insertBeforeUid ? result.findIndex((i) => i.uid === insertBeforeUid) : -1;
            let insertAt = targetIndex === -1 ? result.length : targetIndex;
            for (const item of accepted) {
                result.splice(insertAt++, 0, { ...item, uid: crypto.randomUUID() });
            }
            return result;
        });
    };

    /** Create a new chest on the active tab from dragged items */
    const createChestFromItems = (items: Item[]) => {
        const newItems = dedupeByVariable(items);
        const tabIndex = activeTabIndex();
        if (newItems.length === 0 || tabIndex === -1) return;

        pushUndo();
        // Only the items that actually end up in the new chest leave their source
        removeUidsFromAllChests(new Set(newItems.map((i) => i.uid)));
        const first = newItems[0];
        setState('tabs', tabIndex, 'chests', produce((chests) => chests.push({
            id: getNextChestId(),
            label: displayName(first.item),
            icon: first.item,
            items: newItems,
            checked: false,
        })));
    };

    const removeItemFromChest = (chestId: number, itemUid: string) => {
        const path = findChestPath(chestId);
        if (!path) return;
        pushUndo();
        setState('tabs', path.tabIndex, 'chests', path.chestIndex, 'items',
            (current) => current.filter((item) => item.uid !== itemUid));
    };

    const reorderChestItems = (chestId: number, fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        const path = findChestPath(chestId);
        if (!path) return;
        pushUndo();
        setState('tabs', path.tabIndex, 'chests', path.chestIndex, 'items', produce((items) => {
            const [moved] = items.splice(fromIndex, 1);
            items.splice(toIndex, 0, moved);
        }));
    };

    // ----- Selection -----
    const setSelectedItems = (items: Set<string>) => setState('selectedItems', items);
    const clearSelection = () => setState('selectedItems', new Set<string>());

    /** Delete-key: remove every selected item that lives in a chest */
    const removeSelectedItems = () => {
        const uids = state.selectedItems;
        if (uids.size === 0) return;
        const hasChestItems = state.tabs.some((t) =>
            t.chests.some((c) => c.items.some((item) => uids.has(item.uid))));
        if (!hasChestItems) return;
        pushUndo();
        setState('tabs', produce((tabs) => {
            for (const tab of tabs) {
                for (const chest of tab.chests) {
                    chest.items = chest.items.filter((item) => !uids.has(item.uid));
                }
            }
        }));
        clearSelection();
    };

    // Ctrl-selection: ADD happens on pointerdown (so the new item is part of an
    // immediate drag), REMOVE happens on the trailing click (so ctrl+press on a
    // selected item followed by a drag doesn't kick it out of the selection).
    let ctrlAddedOnPointerDown: string | null = null;
    const toggleItemSelection = (uid: string, ctrlKey: boolean, isClick = false) => {
        // Sets aren't tracked granularly by Solid stores - always replace the Set
        const next = new Set(state.selectedItems);

        if (ctrlKey) {
            if (isClick) {
                const justAdded = ctrlAddedOnPointerDown === uid;
                ctrlAddedOnPointerDown = null;
                if (justAdded || !next.has(uid)) return;
                next.delete(uid);
                setState('selectedItems', next);
                return;
            }
            if (next.has(uid)) return; // deselect sker foerst på click
            ctrlAddedOnPointerDown = uid;
            next.add(uid);
        } else if (!next.has(uid)) {
            next.clear();
            next.add(uid);
        } else if (isClick) {
            // Click on an already-selected item collapses a multi-selection to it.
            // On pointerdown the selection is kept so multi-drag still works.
            next.clear();
            next.add(uid);
        } else {
            return;
        }

        setState('selectedItems', next);
    };

    // ----- Search -----
    const setSearchTerm = (term: string) => setState('searchTerm', term);
    const toggleHighlightChestMatches = () =>
        setState('highlightChestMatches', (on) => !on);

    // ----- View toggles -----
    const setChestGridView = (isGrid: boolean) => {
        setState('chestGridView', isGrid);
        localStorage.setItem(STORAGE_KEYS.chestGridView, String(isGrid));
    };
    const setSidebarGridView = (isGrid: boolean) => {
        setState('sidebarGridView', isGrid);
        localStorage.setItem(STORAGE_KEYS.sidebarGridView, String(isGrid));
    };
    const setChestHeight = (height: ChestHeight) => {
        setState('chestHeight', height);
        localStorage.setItem(STORAGE_KEYS.chestHeight, height);
    };

    // ----- Undo / redo -----
    const undo = () => {
        if (state.undoStack.length === 0) return;
        const previous = state.undoStack[state.undoStack.length - 1];
        setState('redoStack', (stack) => [...stack, snapshotTabs()]);
        setState('undoStack', (stack) => stack.slice(0, -1));
        setState('tabs', structuredClone(unwrap(previous)));
        ensureValidActiveTab();
    };

    const redo = () => {
        if (state.redoStack.length === 0) return;
        const next = state.redoStack[state.redoStack.length - 1];
        setState('undoStack', (stack) => [...stack, snapshotTabs()]);
        setState('redoStack', (stack) => stack.slice(0, -1));
        setState('tabs', structuredClone(unwrap(next)));
        ensureValidActiveTab();
    };

    // ----- Backups -----

    /** Snapshot the current profile to the rolling backup list (skips empty/unchanged) */
    const saveBackup = () => {
        if (!state.tabs.some((t) => t.chests.length > 0)) return;
        const tabs = structuredClone(unwrap(state.tabs));
        const current = readBackups();
        if (current[0] && backupFingerprint(current[0].tabs) === backupFingerprint(tabs)) return;
        const next: ProfileBackup[] = [
            { timestampMs: Date.now(), tabs },
            ...current,
        ].slice(0, MAX_PROFILE_BACKUPS);
        localStorage.setItem(STORAGE_KEYS.backups, JSON.stringify(next));
        setBackups(next);
    };

    const restoreBackup = (timestampMs: number) => {
        const backup = backups().find((b) => b.timestampMs === timestampMs);
        if (backup) replaceTabs(backup.tabs);
    };

    // Session-start restore point of whatever was loaded
    saveBackup();

    // ----- Profiles / presets -----

    /** Replace the whole workspace (file import, code import, preset) */
    const replaceTabs = (rawTabs: RawTab[]) => {
        saveBackup(); // last line of defense against a bad import
        pushUndo();
        const tabs = normalizeTabs(rawTabs);
        setState('tabs', tabs);
        setState('activeTabId', tabs[0]?.id ?? 1);
        clearSelection();
    };

    const loadPreset = async (presetName: string) => {
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}presets/${presetName}.json`);
            if (!response.ok) throw new Error(`Preset request failed: ${response.status}`);
            const preset: { tabs?: RawTab[]; chests?: RawChest[] } = await response.json();

            if (preset.tabs) replaceTabs(preset.tabs);
            else if (preset.chests) replaceTabs([{ name: 'Tab 1', chests: preset.chests }]);
        } catch (error) {
            console.error('Error loading preset:', error);
            alert('Fejl ved indlæsning af skabelon');
        }
    };

    // New profile - wipe everything
    const showNewProfileModal = () => setState('newProfileModalVisible', true);
    const cancelNewProfile = () => setState('newProfileModalVisible', false);
    const confirmNewProfile = () => {
        saveBackup();
        localStorage.removeItem(STORAGE_KEYS.tabs);
        window.location.reload();
    };

    // ----- Persistence -----
    // Debounced: rapid mutations (drags, undo-spam) only hit localStorage once
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingJson: string | null = null;
    const flushPersist = () => {
        if (pendingJson === null) return;
        localStorage.setItem(STORAGE_KEYS.tabs, pendingJson);
        pendingJson = null;
    };
    createEffect(() => {
        pendingJson = JSON.stringify(state.tabs);
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(flushPersist, 300);
    });
    window.addEventListener('beforeunload', flushPersist);

    return {
        state,
        // Derived
        activeTab,
        chests,
        // Tabs
        setActiveTabId,
        addTab,
        removeTab,
        renameTab,
        moveTab,
        // Chests
        addChest,
        moveChest,
        moveChestToTab,
        updateChest,
        deleteChest,
        confirmDeleteChest,
        cancelDeleteChest,
        getNextChestId,
        // Chest items
        moveItemsToChest,
        createChestFromItems,
        removeItemFromChest,
        reorderChestItems,
        // Selection
        setSelectedItems,
        clearSelection,
        toggleItemSelection,
        removeSelectedItems,
        // Search
        setSearchTerm,
        toggleHighlightChestMatches,
        // Views
        setChestGridView,
        setSidebarGridView,
        setChestHeight,
        // History
        undo,
        redo,
        beginUndoBatch,
        endUndoBatch,
        // Profiles
        replaceTabs,
        loadPreset,
        backups,
        restoreBackup,
        showNewProfileModal,
        confirmNewProfile,
        cancelNewProfile,
    };
}

export type AppStore = ReturnType<typeof createAppStore>;

// ===== Provider & hook =====

const AppContext = createContext<AppStore>();

export function AppProvider(props: { children: JSX.Element }) {
    const store = createAppStore();
    return <AppContext.Provider value={store}>{props.children}</AppContext.Provider>;
}

export function useApp(): AppStore {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}

// HMR of a store module recreates the context object and orphans every
// mounted consumer ("useApp must be used within AppProvider") - force a full
// page reload instead when this file changes in dev
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
