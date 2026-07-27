// ChestIconPicker - dropdown (in a portal) for picking a chest's icon
import { FaSolidMagnifyingGlass, FaSolidXmark } from 'solid-icons/fa';
import { createMemo, createSignal, For, onCleanup, Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { ITEM_CATALOG } from '../lib/items';
import SpriteIcon from './SpriteIcon';

const DROPDOWN_HEIGHT_PX = 320;

type ChestIconPickerProps = {
    currentIcon: string;
    onIconChange: (icon: string) => void;
};

const ChestIconPicker: Component<ChestIconPickerProps> = (props) => {
    let iconButtonRef: HTMLDivElement | undefined;
    const [isOpen, setIsOpen] = createSignal(false);
    const [position, setPosition] = createSignal({ top: 0, left: 0 });
    const [searchTerm, setSearchTerm] = createSignal('');

    const close = () => {
        setIsOpen(false);
        window.removeEventListener('click', close);
    };
    onCleanup(() => window.removeEventListener('click', close));

    const toggleDropdown = (e: MouseEvent) => {
        e.stopPropagation();
        if (isOpen()) {
            close();
            return;
        }
        if (!iconButtonRef) return;
        const rect = iconButtonRef.getBoundingClientRect();
        const shouldOpenAbove =
            window.innerHeight - rect.bottom < DROPDOWN_HEIGHT_PX && rect.top > DROPDOWN_HEIGHT_PX;
        setPosition({
            top: shouldOpenAbove ? rect.top - (DROPDOWN_HEIGHT_PX - 10) : rect.bottom + 8,
            left: rect.left,
        });
        setIsOpen(true);
        // Register the outside-click listener after this click has bubbled
        setTimeout(() => window.addEventListener('click', close), 10);
    };

    const selectIcon = (image: string, e: MouseEvent) => {
        e.stopPropagation();
        props.onIconChange(image.replace('.png', ''));
        close();
    };

    const filteredIcons = createMemo(() => {
        const term = searchTerm().toLowerCase();
        return ITEM_CATALOG.filter((entry) => entry.item.toLowerCase().includes(term));
    });

    // Render icons in chunks - creating all ~1400 at once makes opening laggy
    const CHUNK_SIZE = 180;
    const [renderLimit, setRenderLimit] = createSignal(CHUNK_SIZE);
    const visibleIcons = createMemo(() => filteredIcons().slice(0, renderLimit()));
    const handleScroll = (e: Event) => {
        const el = e.currentTarget as HTMLElement;
        if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) {
            setRenderLimit((limit) => Math.min(limit + CHUNK_SIZE, filteredIcons().length));
        }
    };

    return (
        <div class="relative" ref={iconButtonRef}>
            <div
                onClick={toggleDropdown}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <SpriteIcon icon={`${props.currentIcon}.png`} size={32} />
            </div>

            <Show when={isOpen()}>
                <Portal>
                    <div
                        class="fixed z-50 bg-neutral-900 border border-neutral-700 shadow-xl rounded-lg p-3 w-[340px]"
                        style={{
                            top: `${position().top}px`,
                            left: `${position().left}px`,
                            'max-height': '300px',
                            display: 'flex',
                            'flex-direction': 'column',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="relative mb-3">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                                <FaSolidMagnifyingGlass size={14} />
                            </div>
                            <input
                                type="text"
                                placeholder="Søg..."
                                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={searchTerm()}
                                onInput={(e) => {
                                    setSearchTerm(e.currentTarget.value);
                                    setRenderLimit(CHUNK_SIZE);
                                }}
                                autofocus
                            />
                            <Show when={searchTerm()}>
                                <button
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                                    onClick={() => setSearchTerm('')}
                                    aria-label="Ryd søgning"
                                >
                                    <FaSolidXmark size={14} />
                                </button>
                            </Show>
                        </div>
                        <div class="flex-1 overflow-y-auto grid grid-cols-6 gap-2 pr-1" onScroll={handleScroll}>
                            <For each={visibleIcons()}>
                                {(entry) => (
                                    <div
                                        class="cursor-pointer hover:bg-neutral-800 rounded flex justify-center items-center"
                                        style={{ width: '40px', height: '40px', 'flex-shrink': '0' }}
                                        onClick={(e) => selectIcon(entry.image, e)}
                                        title={entry.item}
                                    >
                                        <SpriteIcon icon={entry.image} size={32} />
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Portal>
            </Show>
        </div>
    );
};

export default ChestIconPicker;
