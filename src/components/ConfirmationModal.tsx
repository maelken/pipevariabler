// ConfirmationModal - SolidJS port matching original React styling exactly
import { Component, Show } from 'solid-js';
import { FaSolidXmark } from 'solid-icons/fa';

type ModalVariant = 'danger' | 'warning' | 'info' | 'confirm';

interface ConfirmationModalProps {
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ModalVariant;
}

const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    info: 'bg-blue-600 hover:bg-blue-700',
    confirm: 'bg-green-600 hover:bg-green-700',
};

const ConfirmationModal: Component<ConfirmationModalProps> = (props) => {
    const variant = () => props.variant || 'confirm';
    const confirmText = () => props.confirmText || 'Ja';
    const cancelText = () => props.cancelText || 'Nej';

    return (
        <div
            class="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
            onClick={props.onCancel}
        >
            <div
                class="relative flex flex-col gap-4 p-6 rounded-xl shadow-xl max-w-md w-full mx-4 bg-neutral-900 border border-neutral-700 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-semibold">{props.title}</h2>
                    <button
                        onClick={props.onCancel}
                        class="text-neutral-400 hover:text-white transition-colors p-1"
                    >
                        <FaSolidXmark />
                    </button>
                </div>

                {/* Message */}
                <p class="text-neutral-300 text-sm">{props.message}</p>

                {/* Buttons */}
                <div class="flex gap-3 justify-end mt-2">
                    <button
                        onClick={props.onCancel}
                        class="py-2 px-4 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors"
                    >
                        {cancelText()}
                    </button>
                    <button
                        onClick={props.onConfirm}
                        class={`py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${variantStyles[variant()]}`}
                    >
                        {confirmText()}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
