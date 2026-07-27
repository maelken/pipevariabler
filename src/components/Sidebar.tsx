// Sidebar - the searchable item catalog; every entry is draggable into chests
import { createDraggable } from '@thisbeyond/solid-dnd';
import {
    FaSolidBars, FaSolidBoxOpen, FaSolidMagnifyingGlass, FaSolidTableCellsLarge, FaSolidXmark,
} from 'solid-icons/fa';
import { createMemo, createSignal, For, Show, type Component } from 'solid-js';
import { createSelectAndDragHandlers, type SelectHandler } from '../dnd/activators';
import { displayName } from '../lib/items';
import { useApp } from '../stores/app-store';
import type { Item } from '../types';
import SpriteIcon from './SpriteIcon';

/** Where an item already lives, for the badge links */
type ChestRef = { chestId: number; displayIndex: number };

const SELECTED_CLASS = 'ring-2 ring-inset ring-blue-500 bg-blue-500/20';

const SidebarItem: Component<{
    item: Item;
    index: number;
    view: 'list' | 'grid';
    isSelected: boolean;
    chestRefs?: ChestRef[];
    onSelect: SelectHandler;
    onChestClick?: (chestId: number) => void;
}> = (props) => {
    const draggable = createDraggable(props.item.uid);

    const handlers = createSelectAndDragHandlers({
        uid: () => props.item.uid,
        dragActivators: () => draggable.dragActivators,
        onSelect: (...args) => props.onSelect(...args),
    });

    const chestCount = () => props.chestRefs?.length ?? 0;
    const tooltip = () =>
        `${displayName(props.item.item)}${chestCount() > 0 ? ` (Kister: ${props.chestRefs!.map((c) => `#${c.displayIndex}`).join(', ')})` : ''}`;

    return (
        <Show
            when={props.view === 'grid'}
            fallback={
                <li
                    ref={draggable.ref}
                    onPointerDown={handlers.onPointerDown}
                    onClick={handlers.onClick}
                    class={`relative w-full cursor-pointer p-2 flex items-center gap-4 hover:bg-neutral-700 border-neutral-700 border-b ${props.index === 0 ? 'border-t' : ''} ${props.isSelected ? SELECTED_CLASS : ''}`}
                    style={{ 'user-select': 'none', 'touch-action': 'none' }}
                >
                    <div class="item-icons flex items-center justify-center">
                        <SpriteIcon icon={props.item.image} size={32} />
                    </div>
                    <div class="flex-1 line-clamp-1">{displayName(props.item.item)}</div>
                    <Show when={chestCount() > 0}>
                        <span class="absolute flex items-center text-neutral-400 top-1 right-2 text-xs gap-1">
                            <SpriteIcon icon="barrel.png" size={16} />
                            <For each={props.chestRefs}>
                                {(chestRef, refIndex) => (
                                    <>
                                        <Show when={refIndex() > 0}><span>,</span></Show>
                                        <button
                                            class="hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); props.onChestClick?.(chestRef.chestId); }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            title={`Gå til kiste #${chestRef.displayIndex}`}
                                        >
                                            #{chestRef.displayIndex}
                                        </button>
                                    </>
                                )}
                            </For>
                        </span>
                    </Show>
                </li>
            }
        >
            <div
                ref={draggable.ref}
                onPointerDown={handlers.onPointerDown}
                onClick={handlers.onClick}
                class={`group relative cursor-pointer p-1 rounded border bg-neutral-800 border-neutral-700 hover:bg-neutral-700 transition-colors h-full ${props.isSelected ? SELECTED_CLASS : ''}`}
                title={tooltip()}
                style={{ 'user-select': 'none', 'touch-action': 'none' }}
            >
                <div class="w-8 h-8 mx-auto flex items-center justify-center">
                    <SpriteIcon icon={props.item.image} size={32} />
                </div>
                <Show when={chestCount() > 0}>
                    <div class="absolute -top-1 -right-1 pointer-events-none select-none">
                        <span
                            class="inline-flex items-center justify-center rounded bg-neutral-700 text-white border border-neutral-600 shadow-sm text-[10px] font-medium leading-none px-1.5 py-0.5 min-w-[16px]"
                            aria-label={`${chestCount()} i kister`}
                        >
                            {chestCount() > 9 ? '9+' : String(chestCount())}
                        </span>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

type SidebarProps = {
    onChestClick?: (chestId: number) => void;
};

const Sidebar: Component<SidebarProps> = (props) => {
    const app = useApp();
    const [showAll, setShowAll] = createSignal(true);

    // Search lives in the store so chests can highlight matches
    const searchTerm = () => app.state.searchTerm;
    const setSearchTerm = (term: string) => app.setSearchTerm(term);

    const isGridView = () => app.state.sidebarGridView;

    // itemName -> chest badges, across ALL tabs (chests are numbered globally)
    const chestRefsByItemName = createMemo(() => {
        const map = new Map<string, ChestRef[]>();
        let displayIndex = 1;
        for (const tab of app.state.tabs) {
            for (const chest of tab.chests) {
                for (const item of chest.items) {
                    const refs = map.get(item.item) ?? [];
                    refs.push({ chestId: chest.id, displayIndex });
                    map.set(item.item, refs);
                }
                displayIndex++;
            }
        }
        return map;
    });

    const itemsToShow = createMemo(() => {
        let items = app.state.items;

        const term = searchTerm().toLowerCase();
        if (term) {
            items = items.filter(
                (item) => item.item.toLowerCase().includes(term) || item.variable.toLowerCase().includes(term),
            );
        }

        // "Vis alle" off: hide items that already sit in some chest
        if (!showAll()) {
            const inChests = chestRefsByItemName();
            items = items.filter((item) => !inChests.has(item.item));
        }

        return items;
    });

    return (
        <aside
            class="p-4 border-b md:border-r flex-shrink-0 gap-4 flex flex-col bg-neutral-900 border-neutral-800 dark-theme overflow-hidden min-h-0 h-full md:h-auto md:max-h-screen"
            style={{ width: '368px', 'min-width': '368px' }}
        >
            <div class="logo-dark" />

            {/* Search */}
            <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <FaSolidMagnifyingGlass size={14} />
                </div>
                <input
                    id="sidebar-search"
                    type="text"
                    spellcheck={false}
                    value={searchTerm()}
                    placeholder="Søg..."
                    class="border pl-9 pr-16 py-2 w-full bg-neutral-800 border-neutral-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onInput={(e) => setSearchTerm(e.currentTarget.value)}
                />
                <Show when={searchTerm()}>
                    <button
                        class="absolute right-9 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                        onClick={() => setSearchTerm('')}
                        aria-label="Ryd søgning"
                    >
                        <FaSolidXmark size={14} />
                    </button>
                </Show>
                {/* Toggle: highlight chests containing search matches */}
                <button
                    class={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${app.state.highlightChestMatches
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-neutral-500 hover:text-neutral-300'}`}
                    onClick={() => app.toggleHighlightChestMatches()}
                    aria-pressed={app.state.highlightChestMatches}
                    title="Fremhæv kister der indeholder søge-matches"
                >
                    <FaSolidBoxOpen size={14} />
                </button>
            </div>

            {/* Header + view toggles */}
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">Item liste</h2>
                <div class="flex items-center gap-2">
                    <button
                        onClick={() => setShowAll(!showAll())}
                        class={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${showAll()
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'}`}
                        title={showAll() ? 'Vis kun items der ikke er i kister' : 'Vis alle items'}
                        aria-pressed={showAll()}
                    >
                        <span>Vis alle</span>
                    </button>

                    <button
                        onClick={() => app.setSidebarGridView(!isGridView())}
                        class="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm text-neutral-300 hover:text-white"
                        title={isGridView() ? 'Item-liste: Listevisning' : 'Item-liste: Gittervisning'}
                        aria-pressed={isGridView()}
                    >
                        <Show when={isGridView()} fallback={<FaSolidTableCellsLarge size={14} />}>
                            <FaSolidBars size={14} />
                        </Show>
                        <span>{isGridView() ? 'Liste' : 'Gitter'}</span>
                    </button>
                </div>
            </div>

            {/* Item list */}
            <div class="flex-1 overflow-auto list-container">
                <Show
                    when={isGridView()}
                    fallback={
                        <ul class="chest-items">
                            <For each={itemsToShow()}>
                                {(item, index) => (
                                    <SidebarItem
                                        item={item}
                                        index={index()}
                                        view="list"
                                        chestRefs={chestRefsByItemName().get(item.item)}
                                        isSelected={app.state.selectedItems.has(item.uid)}
                                        onSelect={app.toggleItemSelection}
                                        onChestClick={props.onChestClick}
                                    />
                                )}
                            </For>
                        </ul>
                    }
                >
                    <div class="grid grid-cols-6 gap-2 p-1">
                        <For each={itemsToShow()}>
                            {(item, index) => (
                                <SidebarItem
                                    item={item}
                                    index={index()}
                                    view="grid"
                                    chestRefs={chestRefsByItemName().get(item.item)}
                                    isSelected={app.state.selectedItems.has(item.uid)}
                                    onSelect={app.toggleItemSelection}
                                    onChestClick={props.onChestClick}
                                />
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </aside>
    );
};

export default Sidebar;
