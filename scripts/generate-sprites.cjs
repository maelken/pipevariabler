/**
 * Sprite sheet generator for the Solid app.
 *
 * Packs every icon referenced by src/data.json (plus a few UI icons) into
 * public/assets/images/spritesheet.png and writes the coordinate map to
 * src/spriteMap.json. Unlike the legacy root script it does NOT delete
 * unused icon files - they stay as <img> fallbacks for items from old
 * saved profiles.
 *
 * ICON SOURCE: https://mc.nerothe.com/ (64x64 item icons per Minecraft version)
 *
 * How to update icons for a new Minecraft version:
 *   1. Download the icon pack (zip) for the new version from https://mc.nerothe.com/
 *   2. The files are named "minecraft_<item>.png" - strip the "minecraft_" prefix
 *      and copy them into public/assets/images/icons/ (overwrite existing)
 *   3. Add the new items to src/data.json ({item, variable, image}) next to
 *      related items - the list is curated: survival-only, grouped in families
 *   4. Run:  node scripts/generate-sprites.cjs
 *      (converts to webp automatically via ffmpeg - the app LOADS THE WEBP,
 *       so the sheet is broken until that step has run)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Spritesmith = require('spritesmith');

const ICONS_DIR = path.join(__dirname, '../public/assets/images/icons');
const DATA_JSON_PATH = path.join(__dirname, '../src/data.json');
const OUTPUT_SPRITE = path.join(__dirname, '../public/assets/images/spritesheet.png');
const OUTPUT_MAP = path.join(__dirname, '../src/spriteMap.json');

// UI icons used outside of data.json
const EXTRA_ICONS = ['barrel.png', 'chest.png'];

const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf8'));
const usedIcons = new Set(data.items.map((item) => item.image).filter(Boolean));
EXTRA_ICONS.forEach((icon) => usedIcons.add(icon));

const iconPaths = [];
const missing = [];
for (const icon of usedIcons) {
    const p = path.join(ICONS_DIR, icon);
    if (fs.existsSync(p)) iconPaths.push(p);
    else missing.push(icon);
}

console.log(`Icons referenced: ${usedIcons.size}, found: ${iconPaths.length}`);
if (missing.length) console.warn('MISSING icon files:', missing.join(', '));

Spritesmith.run({ src: iconPaths }, (err, result) => {
    if (err) {
        console.error('Spritesmith error:', err);
        process.exit(1);
    }

    fs.writeFileSync(OUTPUT_SPRITE, result.image);

    const spriteMap = {};
    for (const [fullPath, coords] of Object.entries(result.coordinates)) {
        spriteMap[path.basename(fullPath)] = {
            x: coords.x, y: coords.y, width: coords.width, height: coords.height,
        };
    }
    spriteMap._meta = {
        width: result.properties.width,
        height: result.properties.height,
        image: '/assets/images/spritesheet.png',
    };

    fs.writeFileSync(OUTPUT_MAP, JSON.stringify(spriteMap, null, 2));
    console.log(`Sprite: ${result.properties.width}x${result.properties.height}, ${Object.keys(spriteMap).length - 1} icons`);

    // The app loads the WEBP - regenerating png+map without it breaks every icon
    const webpPath = OUTPUT_SPRITE.replace(/\.png$/, '.webp');
    try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUTPUT_SPRITE,
            '-lossless', '1', '-compression_level', '6', webpPath]);
        console.log(`Webp saved to: ${webpPath}`);
    } catch {
        console.error('ADVARSEL: ffmpeg fejlede/mangler - spritesheet.webp er IKKE opdateret og ikonerne vil vise forkert!');
        process.exit(1);
    }
});
