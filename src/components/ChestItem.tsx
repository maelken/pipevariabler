// ChestItem - one item inside a chest, in list or grid view.
// Every chest item is both draggable AND droppable: dropping onto an item
// inserts at that item's position.
import { createDraggable, createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import { FaSolidXmark } from 'solid-icons/fa';
import { Show, type Component } from 'solid-js';
import { createSelectAndDragHandlers, type SelectHandler } from '../dnd/activators';
import { isChestDragId } from '../dnd/ids';
import { displayName } from '../lib/items';
import { useDrag } from '../stores/drag-store';
import type { Item } from '../types';
import SpriteIcon from './SpriteIcon';

export type ChestItemView = 'list' | 'grid';

type ChestItemProps = {
    item: Item;
    index: number;
    view: ChestItemView;
    isSelected: boolean;
    /** True while a chest is being dragged - items must not swallow pointer events */
    isChestDragActive?: boolean;
    /** Render-only (drag overlay) - MUST NOT register draggables/droppables,
     * their ids collide with the real items and unregister them on unmount */
    preview?: boolean;
    onSelect: SelectHandler;
    onRemove: () => void;
};

const SELECTED_CLASS = 'ring-2 ring-inset ring-blue-500 bg-blue-500/20';

const ChestItem: Component<ChestItemProps> = (props) => {
    const drag = useDrag();
    const dndContext = useDragDropContext();
    const draggable = props.preview ? undefined : createDraggable(props.item.uid);
    const droppable = props.preview ? undefined : createDroppable(props.item.uid);

    const isBeingDragged = () =>
        !props.preview && drag.isDragging() && drag.draggedItems().some((i) => i.uid === props.item.uid);

    // Only register the droppable outside chest drags, so a dragged chest's
    // sortable can be detected through the items
    const setRef = draggable && droppable ? (el: HTMLElement) => {
        draggable.ref(el);
        if (!isChestDragId(dndContext?.[0]?.active.draggableId)) droppable.ref(el);
    } : undefined;

    const handlers = props.preview
        ? { onPointerDown: undefined, onClick: undefined }
        : createSelectAndDragHandlers({
            uid: () => props.item.uid,
            dragActivators: () => draggable!.dragActivators,
            onSelect: (...args) => props.onSelect(...args),
        });

    const interactionStyle = () => ({
        'user-select': 'none' as const,
        'touch-action': 'none' as const,
        // During chest drags the underlying chest sortable must receive the drop
        'pointer-events': (props.isChestDragActive ? 'none' : 'auto') as 'none' | 'auto',
        // Collapse while dragged - the insertion placeholder is the only ghost.
        // display (not unmount) so the active draggable survives in the DOM.
        ...(isBeingDragged() ? { display: 'none' as const } : {}),
    });

    return (
        <Show
            when={props.view === 'grid'}
            fallback={
                <li
                    ref={setRef}
                    onPointerDown={handlers.onPointerDown}
                    onClick={handlers.onClick}
                    class={`relative w-full cursor-pointer p-2 flex items-center gap-4 hover:bg-neutral-700 border-neutral-700 border-b ${props.index === 0 ? 'border-t' : ''} ${props.isSelected ? SELECTED_CLASS : ''}`}
                    style={interactionStyle()}
                >
                    <div class="item-icons flex items-center justify-center">
                        <SpriteIcon icon={props.item.image} size={32} />
                    </div>
                    <div class="flex-1 line-clamp-1">{displayName(props.item.item)}</div>
                    <button
                        class="p-2 text-neutral-400 hover:text-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); props.onRemove(); }}
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
                ref={setRef}
                onPointerDown={handlers.onPointerDown}
                onClick={handlers.onClick}
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
                        onClick={(e) => { e.stopPropagation(); props.onRemove(); }}
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

/** Ghost slot shown at the insertion point while dragging over a chest */
export const ChestItemPlaceholder: Component<{ view: ChestItemView; item: Item | null }> = (props) => (
    <Show
        when={props.view === 'grid'}
        fallback={
            <li class="relative w-full p-2 flex items-center gap-4 border-neutral-700 border-b opacity-50 ring-2 ring-inset ring-blue-500">
                <div class="item-icons flex items-center justify-center">
                    <SpriteIcon icon={props.item?.image ?? ''} size={32} />
                </div>
                <div class="flex-1 line-clamp-1">{displayName(props.item?.item ?? '')}</div>
            </li>
        }
    >
        <div class="group relative p-1 rounded border bg-neutral-800 border-neutral-700 opacity-50 ring-2 ring-inset ring-blue-500">
            <div class="w-8 h-8 mx-auto flex items-center justify-center">
                <SpriteIcon icon={props.item?.image ?? ''} size={32} />
            </div>
        </div>
    </Show>
);

export default ChestItem;
