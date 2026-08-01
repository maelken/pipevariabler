// AppShell - layout, keyboard shortcuts, drag wiring and global modals.
// Kept in its own module (separate from the providers in App.tsx) so hot
// reload never re-creates a context consumer before its provider.
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import { onCleanup, onMount, Show, type Component } from 'solid-js';
import { CHEST_HIGHLIGHT_MS } from '../constants';
import { createDragHandlers } from '../dnd/drag-handlers';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import ChestGrid from './ChestGrid';
import ConfirmationModal from './ConfirmationModal';
import DragOverlays from './DragOverlays';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import TabDropOverlay from './TabDropOverlay';

const AppShell: Component = () => {
    const app = useApp();
    const drag = useDrag();
    const [, { onDragStart, onDragMove, onDragEnd, detectCollisions }] = useDragDropContext()!;

    const handlers = createDragHandlers(app, drag, { detectCollisions });
    onDragStart(handlers.onDragStart);
    onDragMove(handlers.onDragMove);
    onDragEnd(handlers.onDragEnd);

    // Keyboard shortcuts: undo/redo, Ctrl+F -> søgefeltet, Delete -> fjern markerede
    onMount(() => {
        const isTyping = () => {
            const el = document.activeElement;
            return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
                (el instanceof HTMLElement && el.isContentEditable);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            // Før ctrl-genvejene: Delete skal også virke mens Ctrl stadig
            // holdes nede efter et Ctrl+klik-multiselect
            if (e.key === 'Delete' && !isTyping()) {
                e.preventDefault();
                app.removeSelectedItems();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    app.undo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    app.redo();
                } else if (e.key === 'f') {
                    e.preventDefault();
                    const search = document.getElementById('sidebar-search');
                    if (search instanceof HTMLInputElement) {
                        search.focus();
                        search.select();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
    });

    // Klik udenfor et item rydder markeringen. Kører i window-bubble-fasen,
    // dvs. EFTER items' egne click-handlers; items er markeret med
    // data-selectable, og deres fjern-knapper stopper selv propagation.
    onMount(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            if (app.state.selectedItems.size === 0) return;
            const target = e.target instanceof Element ? e.target : null;
            if (target?.closest('[data-selectable]')) return;
            app.clearSelection();
        };
        window.addEventListener('click', handleGlobalClick);
        onCleanup(() => window.removeEventListener('click', handleGlobalClick));
    });

    // Sidebar badge click: jump to the chest (switching tab if needed) and flash it
    const handleChestClick = (chestId: number) => {
        const tab = app.state.tabs.find((t) => t.chests.some((c) => c.id === chestId));
        if (!tab) return;
        if (tab.id !== app.state.activeTabId) app.setActiveTabId(tab.id);

        // Let the tab switch render before scrolling
        setTimeout(() => {
            const chestElement = document.querySelector<HTMLElement>(`[data-chest-id="${chestId}"]`);
            if (!chestElement) return;
            chestElement.scrollIntoView({ behavior: 'auto', block: 'start' });
            chestElement.classList.add('ring-2', 'ring-inset', 'ring-blue-500');
            setTimeout(
                () => chestElement.classList.remove('ring-2', 'ring-inset', 'ring-blue-500'),
                CHEST_HIGHLIGHT_MS,
            );
        }, 150);
    };

    return (
        <div class="flex flex-col h-dvh overflow-hidden bg-neutral-950 text-white">
            <div class="flex flex-1 flex-col md:flex-row min-h-0">
                <Sidebar onChestClick={handleChestClick} />

                <main class="flex-1 p-4 pl-2 flex flex-col gap-2 min-h-0 overflow-hidden">
                    <TabBar />
                    {/* data-drag-scroll: edge-autoscroll target under drags */}
                    <div class="flex-1 min-h-0 overflow-auto" data-drag-scroll>
                        <ChestGrid />
                    </div>
                </main>
            </div>

            {/* Root-level drag visuals - must survive tab switches */}
            <DragOverlays />
            <TabDropOverlay />

            <Show when={app.state.deleteChestModalVisible}>
                <ConfirmationModal
                    onConfirm={app.confirmDeleteChest}
                    onCancel={app.cancelDeleteChest}
                    title="Bekræft sletning"
                    message="Er du sikker på, at du vil slette denne kiste? Den er ikke tom."
                    variant="danger"
                    confirmText="Slet"
                    cancelText="Annuller"
                />
            </Show>

            <Show when={app.state.newProfileModalVisible}>
                <ConfirmationModal
                    onConfirm={app.confirmNewProfile}
                    onCancel={app.cancelNewProfile}
                    title="Ny profil"
                    message="Er du sikker på, at du vil oprette en ny profil? Dette vil slette al nuværende data."
                    variant="warning"
                    confirmText="Opret ny"
                    cancelText="Annuller"
                />
            </Show>
        </div>
    );
};

export default AppShell;
