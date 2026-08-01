// ChestView - PURE presentational chest & item markup.
//
// INVARIANT: this file must NEVER import @thisbeyond/solid-dnd or register
// draggables/droppables. The chest drag overlay renders these components as a
// live preview with the SAME chest/item data as the real chest - any dnd
// registration here would collide with the real ids and unregister them when
// the overlay unmounts (that exact bug has happened once).
import {
    FaRegularCopy, FaRegularSquare, FaSolidCheck, FaSolidPenToSquare, FaSolidSquareCheck, FaSolidXmark,
} from 'solid-icons/fa';
import { createMemo, createSignal, For, Show, type Component, type JSX } from 'solid-js';
import { CMD_LIMIT, COPY_FEEDBACK_MS } from '../constants';
import { chestZoneId } from '../dnd/ids'; // kun id-format, ingen solid-dnd
import { buildCommand, displayName } from '../lib/items';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import type { Chest as ChestData, Item } from '../types';
import ChestIconPicker from './ChestIconPicker';
import SpriteIcon from './SpriteIcon';

export type ItemViewMode = 'list' | 'grid';

const SELECTED_CLASS = 'ring-2 ring-inset ring-blue-500 bg-blue-500/20';

// ===== Item =====

type ChestItemViewProps = {
    item: Item;
    index: number;
    view: ItemViewMode;
    isSelected?: boolean;
    /** Collapse (display none) - used while the item is being dragged */
    hidden?: boolean;
    /** During chest drags the underlying chest sortable must receive the drop */
    disablePointerEvents?: boolean;
    elementRef?: (el: HTMLElement) => void;
    onPointerDown?: (e: PointerEvent) => void;
    onClick?: (e: MouseEvent) => void;
    onRemove?: () => void;
};

export const ChestItemView: Component<ChestItemViewProps> = (props) => {
    const interactionStyle = () => ({
        'user-select': 'none' as const,
        'touch-action': 'none' as const,
        'pointer-events': (props.disablePointerEvents ? 'none' : 'auto') as 'none' | 'auto',
        ...(props.hidden ? { display: 'none' as const } : {}),
    });

    return (
        <Show
            when={props.view === 'grid'}
            fallback={
                <li
                    data-selectable
                    ref={(el) => props.elementRef?.(el)}
                    onPointerDown={props.onPointerDown}
                    onClick={props.onClick}
                    class={`relative w-full cursor-pointer p-2 flex items-center gap-4 hover:bg-neutral-700 border-neutral-700 border-b ${props.index === 0 ? 'border-t' : ''} ${props.isSelected ? SELECTED_CLASS : ''}`}
                    style={interactionStyle()}
                >
                    <div class="item-icons flex items-center justify-center">
                        <SpriteIcon icon={props.item.image} size={32} />
                    </div>
                    <div class="flex-1 line-clamp-1">{displayName(props.item.item)}</div>
                    <button
                        class="p-2 text-neutral-400 hover:text-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); props.onRemove?.(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Fjern"
                        title="Fjern"
                    >
                        <FaSolidXmark />
                    </button>
                </li>
            }
        >
            <div
                data-selectable
                ref={(el) => props.elementRef?.(el)}
                onPointerDown={props.onPointerDown}
                onClick={props.onClick}
                // p-1 i stedet for gap paa grid'et (samme trick som kisternes
                // margin): hit-arealet daekker ogsaa "mellemrummet", saa
                // drag-hover altid rammer et item og aldrig falder igennem
                // til zonen (som ville betyde "indsaet sidst")
                class="p-1"
                style={interactionStyle()}
            >
                <div
                    class={`group relative cursor-pointer p-1 rounded border bg-neutral-800 border-neutral-700 hover:bg-neutral-700 transition-colors ${props.isSelected ? SELECTED_CLASS : ''}`}
                    title={displayName(props.item.item)}
                >
                    <button
                        class="absolute -top-1 -right-1 z-10 w-5 h-5 inline-flex items-center justify-center rounded-md
                           bg-neutral-900/90 text-neutral-300 border border-neutral-700 shadow-sm
                           opacity-80 group-hover:opacity-100
                           hover:bg-neutral-800 hover:text-white
                           focus:outline-none focus:ring focus:ring-neutral-600/40"
                        onClick={(e) => { e.stopPropagation(); props.onRemove?.(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Fjern fra kiste"
                        title="Fjern"
                    >
                        <FaSolidXmark size={10} />
                    </button>
                    <div class="w-8 h-8 mx-auto flex items-center justify-center">
                        <SpriteIcon icon={props.item.image} size={32} />
                    </div>
                </div>
            </div>
        </Show>
    );
};

/**
 * Ghost slot shown at the insertion point while dragging over a chest.
 * `anchorId` er den droppable ghosten staar i stedet for (itemet den skubber,
 * eller kiste-zonen for enden): hit-test-collision skal resolve til SAMME
 * droppable naar cursoren ender over ghosten - ellers flicker previewet
 * (ghost skubber itemet vaek -> hit rammer zonen -> ghost hopper til enden
 * -> itemet er tilbage under cursoren -> forfra).
 */
export const ChestItemPlaceholder: Component<{
    view: ItemViewMode;
    item: Item | null;
    anchorId?: string;
}> = (props) => (
    <Show
        when={props.view === 'grid'}
        fallback={
            <li
                data-droppable-id={props.anchorId}
                class="relative w-full p-2 flex items-center gap-4 border-neutral-700 border-b opacity-50 ring-2 ring-inset ring-blue-500"
            >
                <div class="item-icons flex items-center justify-center">
                    <SpriteIcon icon={props.item?.image ?? ''} size={32} />
                </div>
                <div class="flex-1 line-clamp-1">{displayName(props.item?.item ?? '')}</div>
            </li>
        }
    >
        <div data-droppable-id={props.anchorId} class="p-1">
            <div class="group relative p-1 rounded border bg-neutral-800 border-neutral-700 opacity-50 ring-2 ring-inset ring-blue-500">
                <div class="w-8 h-8 mx-auto flex items-center justify-center">
                    <SpriteIcon icon={props.item?.image ?? ''} size={32} />
                </div>
            </div>
        </div>
    </Show>
);

// ===== Chest card =====

export type ChestRing = 'none' | 'drop' | 'search';

const RING_CLASS: Record<ChestRing, string> = {
    none: '',
    drop: 'ring-2 ring-inset ring-blue-500 border-transparent',
    search: 'ring-2 ring-inset ring-amber-400 border-transparent',
};

type ChestCardViewProps = {
    chest: ChestData;
    index: number;
    gridView?: boolean;
    /** Drag activators from the surrounding sortable, spread onto the header */
    dragHandle?: JSX.HTMLAttributes<HTMLDivElement>;
    ring?: ChestRing;
    /** The interactive wrapper's drop-zone ref - absent in the overlay preview */
    dropZoneRef?: (el: HTMLElement) => void;
    /** How each item renders: interactive ChestItem in the app, plain view in the overlay */
    renderItem: (item: Item, index: number, view: ItemViewMode) => JSX.Element;
};

export const ChestCardView: Component<ChestCardViewProps> = (props) => {
    const app = useApp();
    const drag = useDrag();

    const view = (): ItemViewMode => (props.gridView ? 'grid' : 'list');
    const label = () => props.chest.label || 'Barrel';

    const [isEditing, setIsEditing] = createSignal(false);
    const [editDraft, setEditDraft] = createSignal('');
    const [copied, setCopied] = createSignal(false);

    const isInsertionPointAt = (index: number) =>
        drag.isDragging() && drag.hoverChestId() === props.chest.id && drag.insertionIndex() === index;
    const isInsertionPointAtEnd = () =>
        drag.isDragging() && drag.hoverChestId() === props.chest.id &&
        drag.insertionIndex() >= props.chest.items.length;

    // The items a drop would ACTUALLY insert here, in dragged order: duplicates
    // of what the chest already holds are skipped (same rules as the store's
    // moveItemsToChest), so the ghost slots never promise a dublet that won't
    // land - even when the GRABBED item is the duplicate and the rest aren't
    const previewItems = createMemo(() => {
        const dragged = drag.draggedItems();
        if (dragged.length === 0) return [];
        const draggedUids = new Set(dragged.map((i) => i.uid));
        const existing = new Set(
            props.chest.items.filter((i) => !draggedUids.has(i.uid)).map((i) => i.variable),
        );
        return dragged.filter((item) => {
            if (existing.has(item.variable)) return false;
            existing.add(item.variable);
            return true;
        });
    });

    // ----- Command length budget -----
    const command = createMemo(() => buildCommand(props.chest.items));
    const cmdLength = () => command().length;
    const pct = () => Math.min(100, Math.round((cmdLength() / CMD_LIMIT) * 100));
    const isOverLimit = () => cmdLength() > CMD_LIMIT;

    // ----- Header actions -----
    const startEditing = () => {
        setEditDraft(label());
        setIsEditing(true);
    };

    const saveLabel = () => {
        const newLabel = editDraft().trim();
        if (!newLabel) return;
        app.updateChest(props.chest.id, { label: newLabel });
        setIsEditing(false);
    };

    const toggleDone = () => app.updateChest(props.chest.id, { checked: !props.chest.checked });

    const copyCommand = () => {
        navigator.clipboard.writeText(command());
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    };

    // Every to-be-inserted item gets its own ghost slot at the insertion
    // point, anchored to the droppable the ghosts displace (see
    // ChestItemPlaceholder) so the hit-test stays stable over them
    const placeholderRow = (itemView: ItemViewMode, anchorId: string) => (
        <For each={previewItems()}>
            {(item) => <ChestItemPlaceholder view={itemView} item={item} anchorId={anchorId} />}
        </For>
    );

    const itemsWithPlaceholders = (itemView: ItemViewMode) => (
        <>
            <For each={props.chest.items}>
                {(item, index) => (
                    <>
                        <Show when={isInsertionPointAt(index())}>
                            {placeholderRow(itemView, item.uid)}
                        </Show>
                        {props.renderItem(item, index(), itemView)}
                    </>
                )}
            </For>
            <Show when={isInsertionPointAtEnd()}>
                {placeholderRow(itemView, chestZoneId(props.chest.id))}
            </Show>
        </>
    );

    return (
        <div
            class={`relative flex flex-col border rounded-2xl bg-neutral-900/80 border-neutral-800 p-3 shadow-sm hover:shadow-md transition ${RING_CLASS[props.ring ?? 'none']}`}
            style={{ height: '100%' }}
        >
            {/* Header - drag handle for chest reordering */}
            <div
                class="flex items-center gap-3 cursor-grab active:cursor-grabbing border-b border-neutral-800/50"
                {...(props.dragHandle ?? {})}
            >
                <ChestIconPicker
                    currentIcon={props.chest.icon}
                    onIconChange={(icon) => app.updateChest(props.chest.id, { icon })}
                />

                {/* Title */}
                <div class="group flex-1 min-w-0 text-left flex items-center gap-2">
                    <Show
                        when={isEditing()}
                        fallback={
                            <div class="flex items-center gap-2">
                                <span
                                    class="truncate text-base font-semibold cursor-pointer"
                                    onDblClick={startEditing}
                                >
                                    {label()}
                                </span>
                                <button
                                    class="text-blue-400 hover:text-blue-300 transition-colors"
                                    onClick={startEditing}
                                    aria-label="Rediger navn"
                                >
                                    <FaSolidPenToSquare />
                                </button>
                            </div>
                        }
                    >
                        <div class="flex items-center gap-2 w-full">
                            <input
                                class="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 flex-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                spellcheck={false}
                                value={editDraft()}
                                onInput={(e) => setEditDraft(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveLabel();
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                                autofocus
                            />
                            <button
                                class="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                                onClick={saveLabel}
                            >
                                Gem
                            </button>
                        </div>
                    </Show>
                </div>

                {/* Right actions */}
                <Show when={!isEditing()}>
                    <div class="flex items-center gap-2 text-base">
                        <button
                            onClick={toggleDone}
                            class={`transition-colors ${props.chest.checked ? 'text-green-400 hover:text-green-300' : 'text-neutral-400 hover:text-neutral-200'}`}
                            title={props.chest.checked ? 'Markér som ufærdig' : 'Markér som færdig'}
                        >
                            <Show when={props.chest.checked} fallback={<FaRegularSquare />}>
                                <FaSolidSquareCheck />
                            </Show>
                        </button>

                        <Show when={props.chest.items.length > 0}>
                            <button
                                onClick={copyCommand}
                                class={`transition-colors ${copied() ? 'text-green-400' : 'text-green-500 hover:text-green-400'}`}
                                title="Kopiér kommando"
                            >
                                <Show when={copied()} fallback={<FaRegularCopy />}>
                                    <FaSolidCheck />
                                </Show>
                            </button>
                        </Show>

                        <button
                            onClick={(e) => app.deleteChest(props.chest.id, e.shiftKey)}
                            class="text-red-500 hover:text-red-400 transition-colors"
                            title="Slet kiste (Shift-klik: uden bekræftelse)"
                        >
                            <FaSolidXmark />
                        </button>
                    </div>
                </Show>

                {/* Position number */}
                <div class="absolute top-1 right-2 text-[11px] text-neutral-400 select-none">
                    #{props.index + 1}
                </div>
            </div>

            {/* Command length budget */}
            <div class="mt-2">
                <div class="h-1.5 rounded bg-neutral-800 overflow-hidden">
                    <div
                        class={`h-full ${isOverLimit() ? 'bg-red-600' : pct() > 85 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct()}%`, transition: 'width 150ms ease-out' }}
                    />
                </div>
                <div class="mt-1 text-[12px] text-neutral-400">
                    {cmdLength()}/{CMD_LIMIT} tegn
                    <Show when={isOverLimit()}>
                        <span class="text-red-500 ml-1">– for langt!</span>
                    </Show>
                </div>
            </div>

            {/* Items drop zone - the interactive wrapper's droppable ref bounds the zone */}
            <div
                ref={(el) => props.dropZoneRef?.(el)}
                class={`mt-3 p-2 w-full flex-1 rounded-lg bg-neutral-900/50 border-2 transition-colors ${props.chest.items.length > 0 ? 'border-transparent' : 'border-dashed border-neutral-700'}`}
                style={{ 'overflow-y': 'auto', 'overflow-x': 'hidden', 'min-height': '110px' }}
            >
                <Show
                    when={props.chest.items.length > 0}
                    fallback={
                        <div class="h-full flex items-center justify-center text-neutral-500 text-base font-medium">
                            Træk ting her
                        </div>
                    }
                >
                    <Show
                        when={view() === 'grid'}
                        fallback={<ul class="chest-items dark-theme">{itemsWithPlaceholders('list')}</ul>}
                    >
                        {/* Intet gap - cellerne baerer p-1 selv (droppable hit-areal) */}
                        <div class="grid grid-cols-6">{itemsWithPlaceholders('grid')}</div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};
