// InputModal - styled replacement for window.prompt()
import { FaSolidXmark } from 'solid-icons/fa';
import { createSignal, type Component } from 'solid-js';

type InputModalProps = {
    title: string;
    message?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
};

const InputModal: Component<InputModalProps> = (props) => {
    const [value, setValue] = createSignal('');

    const submit = () => {
        const trimmed = value().trim();
        if (trimmed) props.onSubmit(trimmed);
    };

    return (
        <div
            class="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
            onClick={props.onCancel}
        >
            <div
                class="relative flex flex-col gap-4 p-6 rounded-xl shadow-xl max-w-md w-full mx-4 bg-neutral-900 border border-neutral-700 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold">{props.title}</h2>
                    <button
                        onClick={props.onCancel}
                        class="text-neutral-400 hover:text-white transition-colors p-1"
                        aria-label="Luk"
                    >
                        <FaSolidXmark />
                    </button>
                </div>

                {props.message && <p class="text-neutral-300 text-sm">{props.message}</p>}

                <input
                    type="text"
                    spellcheck={false}
                    value={value()}
                    placeholder={props.placeholder}
                    onInput={(e) => setValue(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') submit();
                        if (e.key === 'Escape') props.onCancel();
                    }}
                    class="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autofocus
                />

                <div class="flex gap-3 justify-end">
                    <button
                        onClick={props.onCancel}
                        class="py-2 px-4 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors"
                    >
                        {props.cancelText ?? 'Annuller'}
                    </button>
                    <button
                        onClick={submit}
                        disabled={!value().trim()}
                        class="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {props.confirmText ?? 'Importér'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InputModal;
