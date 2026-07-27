// SpriteIcon - renders an item icon from the sprite sheet, with a plain <img>
// fallback for icons missing from the sprite map
import { Show, type Component } from 'solid-js';
import { displayName } from '../lib/items';
import spriteMapJson from '../spriteMap.json';

type SpriteCoords = { x: number; y: number; width: number; height: number };

const spriteMap = spriteMapJson as unknown as Record<string, SpriteCoords> & {
    _meta?: { width: number };
};

const SPRITE_URL = `${import.meta.env.BASE_URL}assets/images/spritesheet.webp`;
const SPRITE_SHEET_WIDTH = spriteMap._meta?.width ?? 2304;

const getSpriteCoords = (icon: string): SpriteCoords | undefined =>
    icon === '_meta' ? undefined : spriteMap[icon];

type SpriteIconProps = {
    /** Icon filename, e.g. "stone.png" */
    icon: string;
    /** Size in pixels (default: 32) */
    size?: number;
    class?: string;
};

const SpriteIcon: Component<SpriteIconProps> = (props) => {
    const size = () => props.size ?? 32;
    const coords = () => (props.icon ? getSpriteCoords(props.icon) : undefined);
    const scale = () => size() / (coords()?.width || 64);
    const label = () => displayName(props.icon?.replace('.png', '') ?? '');

    return (
        <Show
            when={props.icon}
            fallback={
                <div
                    class={props.class}
                    style={{
                        width: `${size()}px`,
                        height: `${size()}px`,
                        'background-color': '#404040',
                        'border-radius': '4px',
                        display: 'inline-block',
                    }}
                />
            }
        >
            <Show
                when={coords()}
                fallback={
                    <img
                        src={`${import.meta.env.BASE_URL}assets/images/icons/${props.icon}`}
                        alt={label()}
                        class={props.class}
                        style={{
                            width: `${size()}px`,
                            height: `${size()}px`,
                            'object-fit': 'contain',
                            'image-rendering': 'pixelated',
                        }}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                }
            >
                {(sprite) => (
                    <div
                        class={props.class}
                        role="img"
                        aria-label={label()}
                        title={label()}
                        style={{
                            width: `${size()}px`,
                            height: `${size()}px`,
                            'background-image': `url(${SPRITE_URL})`,
                            'background-position': `-${sprite().x * scale()}px -${sprite().y * scale()}px`,
                            'background-size': `${SPRITE_SHEET_WIDTH * scale()}px auto`,
                            'background-repeat': 'no-repeat',
                            display: 'inline-block',
                            'image-rendering': 'pixelated',
                        }}
                    />
                )}
            </Show>
        </Show>
    );
};

export default SpriteIcon;
