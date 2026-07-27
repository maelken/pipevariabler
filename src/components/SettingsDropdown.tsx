// SettingsDropdown - profile import/export/share, presets, undo/redo
import {
    FaSolidArrowRotateLeft, FaSolidArrowRotateRight, FaSolidBook, FaSolidCaretDown,
    FaSolidCircleInfo, FaSolidClipboard, FaSolidClockRotateLeft, FaSolidFileExport,
    FaSolidFileImport, FaSolidGear, FaSolidPaste, FaSolidShare, FaSolidTerminal, FaSolidUserPlus,
} from 'solid-icons/fa';
import {
    createSignal, For, onCleanup, onMount, Show, type Component, type JSX,
} from 'solid-js';
import { APP_VERSION } from '../constants';
import { buildCommand } from '../lib/items';
import { buildShareUrl, decodeTabs, encodeTabs } from '../lib/profile-codec';
import { useApp } from '../stores/app-store';
import type { ChestHeight, Tab } from '../types';
import InputModal from './InputModal';

const CHEST_HEIGHT_OPTIONS: { value: ChestHeight; label: string; description: string }[] = [
    { value: 'small', label: 'Lav', description: 'Viser 2 rækker pr. kiste' },
    { value: 'medium', label: 'Mellem', description: 'Viser 3 rækker pr. kiste (standard)' },
    { value: 'tall', label: 'Høj', description: 'Viser 6 rækker pr. kiste' },
    { value: 'unlimited', label: 'Fri', description: 'Kister vokser med indholdet' },
];

/** Small ⓘ that reveals a styled tooltip (to its left) on hover */
const InfoHint: Component<{ text: string }> = (props) => (
    <span class="relative group/info flex items-center text-neutral-600 hover:text-neutral-300 transition-colors">
        <FaSolidCircleInfo size={12} />
        <span class="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 w-max max-w-[200px] rounded-md bg-neutral-800 border border-neutral-600 px-2.5 py-1.5 text-xs text-neutral-100 text-left whitespace-normal shadow-xl z-[60] opacity-0 group-hover/info:opacity-100 transition-opacity">
            {props.text}
        </span>
    </span>
);

const MenuItem: Component<{
    icon: JSX.Element;
    label: string;
    /** Shown in a tooltip behind a small ⓘ icon */
    description?: string;
    onClick: () => void;
    disabled?: boolean;
    trailing?: JSX.Element;
}> = (props) => (
    <button
        class="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => props.onClick()}
        disabled={props.disabled}
    >
        {props.icon}
        <span class="whitespace-nowrap">{props.label}</span>
        <span class="ml-auto flex items-center gap-2">
            <Show when={props.trailing}>{props.trailing}</Show>
            <Show when={props.description}>
                {(text) => <InfoHint text={text()} />}
            </Show>
        </span>
    </button>
);

const SectionHeader: Component<{ label: string; withBorderTop?: boolean }> = (props) => (
    <div
        class={`px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider ${props.withBorderTop ? 'border-t' : 'border-b'} border-neutral-800`}
    >
        {props.label}
    </div>
);

const SettingsDropdown: Component = () => {
    const app = useApp();
    const [isOpen, setIsOpen] = createSignal(false);
    let dropdownRef: HTMLDivElement | undefined;
    let fileInputRef: HTMLInputElement | undefined;

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef && !dropdownRef.contains(event.target as Node)) setIsOpen(false);
    };

    onMount(() => document.addEventListener('mousedown', handleClickOutside));
    onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));

    /** Run a menu action and close the dropdown */
    const action = (fn: () => void) => () => {
        fn();
        setIsOpen(false);
    };

    const applyImportedTabs = (tabs: unknown) => {
        if (Array.isArray(tabs) && tabs.length > 0) {
            app.replaceTabs(tabs as Tab[]);
        } else {
            alert('Kunne ikke importere profil - ugyldig fil');
        }
    };

    const handleExport = () => {
        const data = { tabs: app.state.tabs, version: APP_VERSION };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'profile.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFileImport = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data: unknown = JSON.parse(reader.result as string);
                applyImportedTabs((data as { tabs?: unknown }).tabs);
            } catch (error) {
                console.error('Failed to import profile:', error);
                alert('Kunne ikke importere profil - ugyldig fil');
            }
            setIsOpen(false);
        };
        reader.readAsText(file);
    };

    // Alle kisters kommandoer som tekstfil - globalt nummereret som i UI'et
    const handleExportCommands = () => {
        const lines: string[] = [];
        let chestNumber = 1;
        for (const tab of app.state.tabs) {
            if (tab.chests.length === 0) continue;
            lines.push(`=== ${tab.name} ===`);
            for (const chest of tab.chests) {
                const command = buildCommand(chest.items);
                lines.push(`#${chestNumber++} ${chest.label}: ${command || '(tom)'}`);
            }
            lines.push('');
        }
        const blob = new Blob([lines.join('\n').trimEnd() + '\n'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kommandoer.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleShare = () => {
        try {
            navigator.clipboard.writeText(buildShareUrl(app.state.tabs));
            alert('URL kopieret til udklipsholder!');
        } catch (error) {
            console.error('Failed to share:', error);
            alert('Kunne ikke dele profil');
        }
    };

    const handleCopyCode = () => {
        try {
            navigator.clipboard.writeText(encodeTabs(app.state.tabs));
            alert('Kode kopieret til udklipsholder!');
        } catch (error) {
            console.error('Failed to copy code:', error);
        }
    };

    const [importModalVisible, setImportModalVisible] = createSignal(false);
    const [backupsOpen, setBackupsOpen] = createSignal(false);

    const handleImportCode = (code: string) => {
        setImportModalVisible(false);
        const tabs = decodeTabs(code);
        if (tabs) applyImportedTabs(tabs);
        else alert('Kunne ikke importere kode - ugyldig kode');
    };

    return (
        <div class="relative z-50" ref={dropdownRef}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                class="hidden"
                accept="application/json"
            />

            <button
                class="flex items-center gap-2 p-2 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
                onClick={() => setIsOpen(!isOpen())}
                aria-label="Indstillinger"
                aria-expanded={isOpen()}
            >
                <FaSolidGear class="text-neutral-300" />
                <FaSolidCaretDown class={`text-neutral-400 transition-transform ${isOpen() ? 'rotate-180' : ''}`} />
            </button>

            <Show when={isOpen()}>
                <div class="absolute right-0 mt-2 w-64 bg-neutral-900 border border-neutral-700 text-white rounded-lg shadow-xl">
                    <SectionHeader label="Profil" />
                    <div class="p-1">
                        <MenuItem
                            icon={<FaSolidFileImport class="text-blue-400" />}
                            label="Importér profil"
                            description="Indlæs en profil fra en JSON-fil (erstatter alt)"
                            onClick={() => fileInputRef?.click()}
                        />
                        <MenuItem
                            icon={<FaSolidFileExport class="text-green-400" />}
                            label="Eksportér profil"
                            description="Gem hele profilen som en JSON-fil"
                            onClick={action(handleExport)}
                        />
                        <MenuItem
                            icon={<FaSolidTerminal class="text-lime-400" />}
                            label="Eksportér kommandoer"
                            description="Download alle kisters /signedit-kommandoer som tekstfil"
                            onClick={action(handleExportCommands)}
                        />
                        <MenuItem
                            icon={<FaSolidShare class="text-teal-400" />}
                            label="Del profil (URL)"
                            description="Kopiér et link der åbner denne profil direkte"
                            onClick={action(handleShare)}
                        />
                        <MenuItem
                            icon={<FaSolidClipboard class="text-orange-400" />}
                            label="Kopiér kode"
                            description="Kopiér profilen som en kompakt kode til deling"
                            onClick={action(handleCopyCode)}
                        />
                        <MenuItem
                            icon={<FaSolidPaste class="text-pink-400" />}
                            label="Importér kode"
                            description="Indsæt en delt kode og erstat profilen"
                            onClick={action(() => setImportModalVisible(true))}
                        />
                        <MenuItem
                            icon={<FaSolidUserPlus class="text-purple-400" />}
                            label="Ny profil"
                            description="Slet al nuværende data og start forfra"
                            onClick={action(app.showNewProfileModal)}
                        />
                    </div>

                    <SectionHeader label="Kistehøjde" withBorderTop />
                    <div class="p-2 flex gap-1">
                        {CHEST_HEIGHT_OPTIONS.map((option) => (
                            <button
                                class={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${app.state.chestHeight === option.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'}`}
                                title={option.description}
                                onClick={() => app.setChestHeight(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <SectionHeader label="Skabeloner" withBorderTop />
                    <div class="p-1">
                        <MenuItem
                            icon={<FaSolidBook class="text-cyan-400" />}
                            label="Ivers Kisterum"
                            description="Indlæs skabelon med 160 kister fra Ivers kisterum (erstatter alt)"
                            onClick={action(() => void app.loadPreset('ivers_kisterum'))}
                        />
                    </div>

                    <SectionHeader label="Handlinger" withBorderTop />
                    <div class="p-1">
                        {/* Undo/redo keep the menu open so they can be clicked repeatedly */}
                        <MenuItem
                            icon={<FaSolidArrowRotateLeft class="text-amber-400" />}
                            label="Fortryd"
                            description="Fortryd seneste ændring"
                            onClick={app.undo}
                            disabled={app.state.undoStack.length === 0}
                            trailing={<kbd class="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">Ctrl+Z</kbd>}
                        />
                        <MenuItem
                            icon={<FaSolidArrowRotateRight class="text-amber-400" />}
                            label="Gentag"
                            description="Gentag den fortrudte ændring"
                            onClick={app.redo}
                            disabled={app.state.redoStack.length === 0}
                            trailing={<kbd class="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">Ctrl+Y</kbd>}
                        />
                        {/* Backups: foldet sammen bag ét punkt */}
                        <MenuItem
                            icon={<FaSolidClockRotateLeft class="text-sky-400" />}
                            label="Backups"
                            description="Gendan et tidligere snapshot af profilen. Din nuværende profil gemmes som backup først."
                            onClick={() => setBackupsOpen(!backupsOpen())}
                            trailing={
                                <span class="flex items-center gap-1 text-xs text-neutral-500">
                                    {app.backups().length}
                                    <FaSolidCaretDown class={`transition-transform ${backupsOpen() ? 'rotate-180' : ''}`} />
                                </span>
                            }
                        />
                        <Show when={backupsOpen()}>
                            <Show
                                when={app.backups().length > 0}
                                fallback={<div class="pl-10 pr-3 py-1.5 text-xs text-neutral-500">Ingen backups endnu</div>}
                            >
                                <For each={app.backups()}>
                                    {(backup) => {
                                        const chestCount = backup.tabs.reduce((n, t) => n + t.chests.length, 0);
                                        const when = new Date(backup.timestampMs).toLocaleString('da-DK', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                        });
                                        return (
                                            <button
                                                class="w-full flex items-center gap-2 pl-10 pr-3 py-1.5 text-xs rounded-md text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                                                onClick={action(() => app.restoreBackup(backup.timestampMs))}
                                                title="Gendan denne backup"
                                            >
                                                <span>{when}</span>
                                                <span class="ml-auto text-neutral-500">{chestCount} kister</span>
                                            </button>
                                        );
                                    }}
                                </For>
                            </Show>
                        </Show>
                    </div>

                    <div class="px-3 py-2 text-xs text-neutral-500 border-t border-neutral-800 text-center">
                        v{APP_VERSION} • Lavet af WhoToldYou
                    </div>
                </div>
            </Show>

            <Show when={importModalVisible()}>
                <InputModal
                    title="Importér kode"
                    message="Indsæt en delt profil-kode. Den erstatter al nuværende data."
                    placeholder="Indsæt kode..."
                    onSubmit={handleImportCode}
                    onCancel={() => setImportModalVisible(false)}
                />
            </Show>
        </div>
    );
};

export default SettingsDropdown;
