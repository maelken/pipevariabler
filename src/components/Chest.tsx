// Chest - a droppable container of items with an editable header and the
// generated /signedit command's length budget
import { createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import {
    FaRegularCopy, FaRegularSquare, FaSolidCheck, FaSolidPenToSquare, FaSolidSquareCheck, FaSolidXmark,
} from 'solid-icons/fa';
import { createEffect, createMemo, createSignal, For, Show, type Component, type JSX } from 'solid-js';
import { CMD_LIMIT, COPY_FEEDBACK_MS } from '../constants';
import { chestZoneId, isChestDragId } from '../dnd/ids';
import { buildCommand } from '../lib/items';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import type { Chest as ChestData } from '../types';
import ChestIconPicker from './ChestIconPicker';
import ChestItem, { ChestItemPlaceholder, type ChestItemView } from './ChestItem';

type ChestProps = {
    chest: ChestData;
    index: number;
    gridView?: boolean;
    /** Drag activators from the surrounding sortable, spread onto the header */
    dragHandle?: JSX.HTMLAttributes<HTMLDivElement>;
    /** True while a chest is being dragged (disables item pointer events) */
    isChestDragActive?: boolean;
    /**
     * Render-only mode for the drag overlay. MUST skip all dnd registrations:
     * a preview with live droppables/draggables shares ids with the real chest
     * and unregisters the real ones when the overlay unmounts.
     */
    preview?: boolean;
};

const Chest: Component<ChestProps> = (props) => {
    const app = useApp();
    const drag = useDrag();
    const [dndState] = useDragDropContext()!;
    const droppable = props.preview ? undefined : createDroppable(chestZoneId(props.chest.id));

    const view = (): ChestItemView => (props.gridView ? 'grid' : 'list');
    const label = () => props.chest.label || 'Barrel';

    const [isEditing, setIsEditing] = createSignal(false);
    const [editDraft, setEditDraft] = createSignal('');
    const [copied, setCopied] = createSignal(false);

    // ----- Insertion placeholder tracking -----
    if (!props.preview) createEffect(() => {
        const { droppableId, draggableId } = dndState.active;
        if (typeof draggableId !== 'string' || !draggableId) return; // only item drags

        // Hovering the chest itself (zone or sortable): insert at the end
        if (droppableId === chestZoneId(props.chest.id) || droppableId === props.chest.id) {
            drag.updatePlaceholder(props.chest.id, props.chest.items.length);
            return;
        }
        // Hovering an item in THIS chest: insert at its position
        if (typeof droppableId === 'string') {
            const hoveredIndex = props.chest.items.findIndex((item) => item.uid === droppableId);
            if (hoveredIndex !== -1) {
                drag.updatePlaceholder(props.chest.id, hoveredIndex);
                return;
            }
        }
        // Left this chest: clear our placeholder
        if (drag.hoverChestId() === props.chest.id) drag.updatePlaceholder(null, -1);
    });

    // A drop only does something if it's a reorder within this chest, or at
    // least one dragged item isn't already here (duplicates are skipped on
    // drop) - hide the insertion preview and highlight otherwise
    const wouldAcceptDrop = () => {
        if (drag.sourceChestId() === props.chest.id) return true;
        const existingVariables = new Set(props.chest.items.map((item) => item.variable));
        return drag.draggedItems().some((item) => !existingVariables.has(item.variable));
    };

    const isInsertionPointAt = (index: number) =>
        drag.isDragging() && drag.hoverChestId() === props.chest.id &&
        drag.insertionIndex() === index && wouldAcceptDrop();
    const isInsertionPointAtEnd = () =>
        drag.isDragging() && drag.hoverChestId() === props.chest.id &&
        drag.insertionIndex() >= props.chest.items.length && wouldAcceptDrop();

    // ----- Command length budget -----
    const command = createMemo(() => buildCommand(props.chest.items));
    const cmdLength = () => command().length;
    const pct = () => Math.min(100, Math.round((cmdLength() / CMD_LIMIT) * 100));
    const isOverLimit = () => cmdLength() > CMD_LIMIT;

    // Amber ring when the sidebar search matches an item in this chest
    // (opt-in via the toggle next to the search field)
    const matchesSearch = createMemo(() => {
        if (!app.state.highlightChestMatches) return false;
        const term = app.state.searchTerm.toLowerCase();
        if (!term) return false;
        return props.chest.items.some(
            (item) => item.item.toLowerCase().includes(term) || item.variable.toLowerCase().includes(term),
        );
    });

    // Highlight while an item drag hovers anything belonging to this chest -
    // but only when the drop would actually change something
    const isOver = () => {
        if (!droppable) return false;
        const { draggableId, droppableId } = dndState.active;
        if (typeof draggableId !== 'string') return false;
        if (!wouldAcceptDrop()) return false;
        if (droppable.isActiveDroppable) return true;
        if (droppableId === props.chest.id) return true;
        return props.chest.items.some((item) => droppableId === item.uid);
    };

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

    const itemsWithPlaceholders = (itemView: ChestItemView) => (
        <>
            <For each={props.chest.items}>
                {(item, index) => (
                    <>
                        <Show when={isInsertionPointAt(index())}>
                            <ChestItemPlaceholder view={itemView} item={drag.activeItem()} />
                        </Show>
                        <ChestItem
                            item={item}
                            index={index()}
                            view={itemView}
                            preview={props.preview}
                            isSelected={app.state.selectedItems.has(item.uid)}
                            isChestDragActive={props.isChestDragActive}
                            onSelect={app.toggleItemSelection}
                            onRemove={() => {
                                // X på et multi-markeret item fjerner hele markeringen
                                if (app.state.selectedItems.has(item.uid) && app.state.selectedItems.size > 1) {
                                    app.removeSelectedItems();
                                } else {
                                    app.removeItemFromChest(props.chest.id, item.uid);
                                }
                            }}
                        />
                    </>
                )}
            </For>
            <Show when={isInsertionPointAtEnd()}>
                <ChestItemPlaceholder view={itemView} item={drag.activeItem()} />
            </Show>
        </>
    );

    return (
        <div
            data-chest-id={props.chest.id}
            class={`relative flex flex-col border rounded-2xl bg-neutral-900/80 border-neutral-800 p-3 shadow-sm hover:shadow-md transition ${isOver()
                ? 'ring-2 ring-inset ring-blue-500 border-transparent'
                : matchesSearch() ? 'ring-2 ring-inset ring-amber-400 border-transparent' : ''}`}
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

            {/* Items drop zone - the droppable ref sits here to bound the zone */}
            <div
                ref={droppable?.ref}
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
                        <div class="grid grid-cols-6 gap-2">{itemsWithPlaceholders('grid')}</div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};

export default Chest;
