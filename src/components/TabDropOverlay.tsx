// TabDropOverlay - fixed-position drop zones aligned with the tab buttons.
// The tab buttons live inside TabBar's NESTED DragDropProvider, so drags from
// the root provider can't target them directly; these zones bridge that gap.
// They are always mounted (never inside a Show) - droppables must not unmount
// mid-drag.
import { createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import {
    createEffect, createSignal, For, onCleanup, onMount, type Component,
} from 'solid-js';
import { TAB_SWITCH_DELAY_MS } from '../constants';
import { markDroppable } from '../dnd/collision';
import { isChestDragId, tabButtonId, tabZoneId } from '../dnd/ids';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';

type TabRect = { id: number; rect: DOMRect };

// Hovering a tab during a drag switches to it after a short dwell.
// Chest drags MOVE the chest into the tab first, so the chest stays inside the
// new tab's SortableProvider and the drag survives the switch.
const TabDropZone: Component<{ tabId: number; rect: DOMRect }> = (props) => {
    const app = useApp();
    const drag = useDrag();
    const dndContext = useDragDropContext();
    const droppable = createDroppable(tabZoneId(props.tabId));

    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    const isAnyDrag = () =>
        drag.isDragging() || isChestDragId(dndContext?.[0]?.active.draggableId);

    createEffect(() => {
        const active = dndContext?.[0]?.active;
        const isOverThis = active?.droppableId === tabZoneId(props.tabId);
        const isActiveTab = app.state.activeTabId === props.tabId;

        if (isOverThis && !isActiveTab && isAnyDrag()) {
            const draggableId = active?.draggableId;
            hoverTimeout = setTimeout(() => {
                if (isChestDragId(draggableId)) app.moveChestToTab(draggableId, props.tabId);
                else app.setActiveTabId(props.tabId);
            }, TAB_SWITCH_DELAY_MS);
        } else if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
    });

    onCleanup(() => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
    });

    const showHighlight = () =>
        isAnyDrag() && dndContext?.[0]?.active.droppableId === tabZoneId(props.tabId);

    return (
        <div
            ref={(el) => {
                markDroppable(el, tabZoneId(props.tabId));
                droppable.ref(el);
            }}
            class={`fixed z-50 ${showHighlight() ? 'ring-2 ring-blue-500 bg-blue-500/30 rounded' : ''}`}
            style={{
                left: `${props.rect.left}px`,
                top: `${props.rect.top}px`,
                width: `${props.rect.width}px`,
                height: `${props.rect.height}px`,
                // Invisible and click-through except during drags
                'pointer-events': isAnyDrag() ? 'auto' : 'none',
                opacity: isAnyDrag() ? 1 : 0,
            }}
        />
    );
};

const TabDropOverlay: Component = () => {
    const app = useApp();
    const [tabRects, setTabRects] = createSignal<TabRect[]>([]);

    const measureTabRects = () => {
        setTabRects(app.state.tabs.flatMap((tab) => {
            const button = document.getElementById(tabButtonId(tab.id));
            return button ? [{ id: tab.id, rect: button.getBoundingClientRect() }] : [];
        }));
    };

    // Kiste-containerens scroll flytter ikke tab-baren - spring den over, saa
    // (auto)scroll under drags ikke re-maaler og re-renderer alle zoner pr. ryk
    const handleScroll = (e: Event) => {
        if (e.target instanceof Element && e.target.hasAttribute('data-drag-scroll')) return;
        measureTabRects();
    };

    onMount(() => {
        measureTabRects();
        window.addEventListener('resize', measureTabRects);
        window.addEventListener('scroll', handleScroll, true);
        onCleanup(() => {
            window.removeEventListener('resize', measureTabRects);
            window.removeEventListener('scroll', handleScroll, true);
        });
    });

    // Re-measure when tabs are added/removed or the active tab changes
    createEffect(() => {
        void app.state.tabs.length;
        void app.state.activeTabId;
        setTimeout(measureTabRects, 50); // let the tab bar re-render first
    });

    return (
        <For each={tabRects()}>
            {(tabRect) => <TabDropZone tabId={tabRect.id} rect={tabRect.rect} />}
        </For>
    );
};

export default TabDropOverlay;
