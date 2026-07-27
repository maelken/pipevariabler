// TabBar - profile name, sortable tabs, undo/redo, view toggle and settings.
// Tab sorting runs in its OWN nested DragDropProvider so it can't interfere
// with item/chest drags on the root provider.
import {
    closestCenter, createSortable, DragDropProvider, DragDropSensors, DragOverlay,
    SortableProvider, useDragDropContext, type DragEventHandler,
} from '@thisbeyond/solid-dnd';
import {
    FaSolidArrowRotateLeft, FaSolidArrowRotateRight, FaSolidBars, FaSolidPenToSquare,
    FaSolidPlus, FaSolidTableCellsLarge, FaSolidXmark,
} from 'solid-icons/fa';
import { createMemo, createSignal, For, Show, type Component } from 'solid-js';
import { tabButtonId, tabSortableId } from '../dnd/ids';
import { useApp } from '../stores/app-store';
import SettingsDropdown from './SettingsDropdown';

const TAB_SORTABLE_PREFIX = 'tab-';

const parseTabSortableId = (id: string | number): number | null => {
    const idStr = String(id);
    return idStr.startsWith(TAB_SORTABLE_PREFIX)
        ? Number.parseInt(idStr.slice(TAB_SORTABLE_PREFIX.length), 10)
        : null;
};

// Floating preview of the tab being dragged
const TabDragPreview: Component<{ getTabRange: (tabIndex: number) => string }> = (props) => {
    const app = useApp();
    const dndContext = useDragDropContext();

    const activeTab = createMemo(() => {
        const activeId = dndContext?.[0].active.draggable?.id;
        if (activeId == null) return null;
        const tabId = parseTabSortableId(activeId);
        return tabId === null ? null : app.state.tabs.find((t) => t.id === tabId);
    });

    return (
        <Show when={activeTab()}>
            {(tab) => (
                <div
                    class={`flex-shrink-0 px-3 py-1 text-sm rounded border-b-2 transition-colors flex items-center gap-1 cursor-grabbing
                        ${app.state.activeTabId === tab().id
                            ? 'bg-neutral-800 border-blue-400 text-white'
                            : 'bg-neutral-900 border-transparent text-neutral-300'}`}
                    style={{ 'box-shadow': '0 4px 12px rgba(0,0,0,0.4)' }}
                >
                    <span class="truncate">
                        {tab().name}
                        {props.getTabRange(app.state.tabs.findIndex((t) => t.id === tab().id))}
                    </span>
                    <Show when={app.state.tabs.length > 1}>
                        <span class="text-red-500 flex-shrink-0">
                            <FaSolidXmark size={10} />
                        </span>
                    </Show>
                </div>
            )}
        </Show>
    );
};

const SortableTab: Component<{
    tabId: number;
    tabName: string;
    isActive: boolean;
    isEditing: boolean;
    rangeText: string;
    canRemove: boolean;
    /** Sidebar search (highlight mode) matches an item in this tab */
    hasSearchMatch: boolean;
    onActivate: () => void;
    onStartEdit: () => void;
    onRemove: () => void;
    onNameChange: (name: string) => void;
    onFinishEdit: () => void;
}> = (props) => {
    const sortable = createSortable(tabSortableId(props.tabId));

    return (
        <div
            ref={sortable.ref}
            {...sortable.dragActivators}
            class={`flex-shrink-0 mr-2 ${sortable.isActiveDraggable ? 'opacity-50 ring-2 ring-blue-400 ring-inset rounded' : ''}`}
            style={{ cursor: sortable.isActiveDraggable ? 'grabbing' : 'grab' }}
        >
            <Show
                when={props.isEditing}
                fallback={
                    <button
                        id={tabButtonId(props.tabId)}
                        type="button"
                        class={`flex-shrink-0 px-3 py-1 text-sm rounded border-b-2 transition-colors flex items-center gap-1 ${props.isActive
                            ? 'bg-neutral-800 border-blue-400 text-white'
                            : 'bg-neutral-900 border-transparent text-neutral-300 hover:text-white hover:bg-neutral-800'} ${props.hasSearchMatch ? 'ring-1 ring-inset ring-amber-400' : ''}`}
                        onClick={() => {
                            if (!sortable.isActiveDraggable) props.onActivate();
                        }}
                        onDblClick={() => props.onStartEdit()}
                    >
                        <span class="truncate">{props.tabName}{props.rangeText}</span>
                        <Show when={props.canRemove}>
                            <span
                                class="text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); props.onRemove(); }}
                                title="Luk tab"
                            >
                                <FaSolidXmark size={10} />
                            </span>
                        </Show>
                    </button>
                }
            >
                <input
                    type="text"
                    spellcheck={false}
                    value={props.tabName}
                    onInput={(e) => props.onNameChange(e.currentTarget.value)}
                    onBlur={() => props.onFinishEdit()}
                    onKeyDown={(e) => { if (e.key === 'Enter') props.onFinishEdit(); }}
                    class="px-3 py-1 text-sm rounded bg-neutral-800 text-white focus:outline-none ring-2 ring-inset ring-blue-500 min-w-[100px]"
                    autofocus
                />
            </Show>
        </div>
    );
};

const HistoryButton: Component<{
    onClick: () => void;
    disabled: boolean;
    label: string;
    shortcut: string;
    icon: 'undo' | 'redo';
}> = (props) => (
    <button
        onClick={() => props.onClick()}
        disabled={props.disabled}
        class={`p-2 rounded transition-colors ${props.disabled
            ? 'text-neutral-600 cursor-not-allowed'
            : 'text-neutral-300 hover:text-white hover:bg-neutral-700'}`}
        title={`${props.label} (${props.shortcut})`}
        aria-label={props.label}
    >
        <Show when={props.icon === 'undo'} fallback={<FaSolidArrowRotateRight size={14} />}>
            <FaSolidArrowRotateLeft size={14} />
        </Show>
    </button>
);

const TabBar: Component = () => {
    const app = useApp();

    const [profileName, setProfileName] = createSignal('Ny Profil');
    const [isEditingProfileName, setIsEditingProfileName] = createSignal(false);
    const [editingTabId, setEditingTabId] = createSignal<number | null>(null);

    const tabSortableIds = createMemo(() => app.state.tabs.map((tab) => tabSortableId(tab.id)));

    // Tabs med søge-matches (kun i highlight-mode) - viser hvor kisterne bor,
    // siden inaktive tabs ikke er rendered
    const tabsWithSearchMatch = createMemo(() => {
        if (!app.state.highlightChestMatches) return new Set<number>();
        const term = app.state.searchTerm.toLowerCase();
        if (!term) return new Set<number>();
        return new Set(app.state.tabs
            .filter((tab) => tab.chests.some((chest) => chest.items.some(
                (item) => item.item.toLowerCase().includes(term) || item.variable.toLowerCase().includes(term),
            )))
            .map((tab) => tab.id));
    });

    // "(3-7)" - the global chest numbers a tab covers
    const getTabRange = (tabIndex: number) => {
        const tabs = app.state.tabs;
        if (tabIndex < 0 || !tabs[tabIndex] || tabs[tabIndex].chests.length === 0) return '';
        let startId = 1;
        for (let i = 0; i < tabIndex; i++) startId += tabs[i].chests.length;
        const endId = startId + tabs[tabIndex].chests.length - 1;
        return startId === endId ? ` (${startId})` : ` (${startId}-${endId})`;
    };

    // Tabs reorder live while dragging over them - nothing left to do on drop
    const handleDragOver: DragEventHandler = ({ draggable, droppable }) => {
        if (!droppable) return;
        const fromTabId = parseTabSortableId(draggable.id);
        const toTabId = parseTabSortableId(droppable.id);
        if (fromTabId === null || toTabId === null || fromTabId === toTabId) return;

        const fromIndex = app.state.tabs.findIndex((t) => t.id === fromTabId);
        const toIndex = app.state.tabs.findIndex((t) => t.id === toTabId);
        if (fromIndex !== -1 && toIndex !== -1) app.moveTab(fromIndex, toIndex);
    };

    return (
        <div class="grid grid-cols-[auto_1fr_auto] items-center gap-4 h-8 w-full pl-2">
            {/* Profile name */}
            <div class="flex items-center gap-2">
                <Show
                    when={isEditingProfileName()}
                    fallback={
                        <>
                            <span class="text-xl font-bold">{profileName()}</span>
                            <button
                                class="text-blue-400 hover:text-blue-300 transition-colors"
                                onClick={() => setIsEditingProfileName(true)}
                                aria-label="Rediger profilnavn"
                            >
                                <FaSolidPenToSquare />
                            </button>
                        </>
                    }
                >
                    <input
                        type="text"
                        spellcheck={false}
                        value={profileName()}
                        onInput={(e) => setProfileName(e.currentTarget.value)}
                        placeholder="Profilnavn"
                        class="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                        class="text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => setIsEditingProfileName(false)}
                    >
                        Gem
                    </button>
                </Show>
            </div>

            {/* Sortable tabs (cross-tab drops are handled by TabDropOverlay) */}
            <div class="min-w-0 overflow-hidden">
                <DragDropProvider
                    onDragStart={() => app.beginUndoBatch()}
                    onDragEnd={() => app.endUndoBatch()}
                    onDragOver={handleDragOver}
                    collisionDetector={closestCenter}
                >
                    <DragDropSensors>
                        <div
                            onWheel={(e) => {
                                const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
                                if (dx !== 0) {
                                    e.preventDefault();
                                    e.currentTarget.scrollLeft += dx;
                                }
                            }}
                            class="flex items-center overflow-x-auto overflow-y-hidden"
                            style={{ 'max-width': '100%', width: '100%' }}
                        >
                            <SortableProvider ids={tabSortableIds()}>
                                <For each={app.state.tabs}>
                                    {(tab, tabIndex) => (
                                        <SortableTab
                                            tabId={tab.id}
                                            tabName={tab.name}
                                            isActive={app.state.activeTabId === tab.id}
                                            hasSearchMatch={tabsWithSearchMatch().has(tab.id)}
                                            isEditing={editingTabId() === tab.id}
                                            rangeText={getTabRange(tabIndex())}
                                            canRemove={app.state.tabs.length > 1}
                                            onActivate={() => app.setActiveTabId(tab.id)}
                                            onStartEdit={() => setEditingTabId(tab.id)}
                                            onRemove={() => app.removeTab(tab.id)}
                                            onNameChange={(name) => app.renameTab(tab.id, name)}
                                            onFinishEdit={() => setEditingTabId(null)}
                                        />
                                    )}
                                </For>
                            </SortableProvider>
                            <button
                                type="button"
                                class="flex-shrink-0 px-2 py-1 text-sm rounded border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors"
                                onClick={() => app.addTab()}
                                title="Tilføj ny tab"
                            >
                                <FaSolidPlus size={12} />
                            </button>
                        </div>

                        <DragOverlay>
                            <TabDragPreview getTabRange={getTabRange} />
                        </DragOverlay>
                    </DragDropSensors>
                </DragDropProvider>
            </div>

            {/* Right-side actions */}
            <div class="flex items-center gap-2">
                {/* Fremdrift: faerdig-markerede kister på tvaers af alle tabs */}
                <Show when={app.state.tabs.some((t) => t.chests.length > 0)}>
                    <span
                        class="text-sm text-neutral-400 select-none"
                        title="Kister markeret som færdige"
                    >
                        {app.state.tabs.reduce((n, t) => n + t.chests.filter((c) => c.checked).length, 0)}
                        /
                        {app.state.tabs.reduce((n, t) => n + t.chests.length, 0)} færdige
                    </span>
                </Show>
                <div class="flex items-center gap-1">
                    <HistoryButton
                        icon="undo"
                        label="Fortryd"
                        shortcut="Ctrl+Z"
                        disabled={app.state.undoStack.length === 0}
                        onClick={() => app.undo()}
                    />
                    <HistoryButton
                        icon="redo"
                        label="Gentag"
                        shortcut="Ctrl+Y"
                        disabled={app.state.redoStack.length === 0}
                        onClick={() => app.redo()}
                    />
                </div>

                {/* Chest grid/list toggle */}
                <button
                    onClick={() => app.setChestGridView(!app.state.chestGridView)}
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm text-neutral-300 hover:text-white"
                    title={app.state.chestGridView ? 'Kister: Listevisning' : 'Kister: Gittervisning'}
                    aria-pressed={app.state.chestGridView}
                >
                    {app.state.chestGridView ? <FaSolidBars size={14} /> : <FaSolidTableCellsLarge size={14} />}
                    <span>{app.state.chestGridView ? 'Liste' : 'Gitter'}</span>
                </button>

                <SettingsDropdown />
            </div>
        </div>
    );
};

export default TabBar;
