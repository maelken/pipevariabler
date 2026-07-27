# Pipe Variabler

En Minecraft storage planlægnings-app til at organisere kister og generere `/signedit` kommandoer.

**Lavet af WhoToldYou** • [Live Demo](https://pipes.maelk.net)

## Om appen

Pipe Variabler hjælper dig med at planlægge dit Minecraft storage room ved at lade dig:
- Organisere items i virtuelle kister
- Generere `/signedit` kommandoer automatisk (max 256 tegn)
- Gemme og dele profiler via URL eller kode
- Holde styr på hvilke items der er i hvilke kister

## Features

### Drag & Drop
- **Multi-select** - Vælg flere items med Ctrl+klik og træk dem alle på én gang
- **Drag til tabs** - Træk items eller hele kister direkte til andre tabs
- **Omarrangér kister** - Træk kister for at ændre rækkefølgen
- **Auto-skift tab** - Hold over et tab mens du dragger for automatisk at skifte til det
- **Opret kiste ved drop** - Træk items til "Tilføj kiste"-zonen for at oprette en ny kiste
- **Dublet-beskyttelse** - Preview vises kun når droppet faktisk tilføjer noget

### Organisation
- **Tabs** - Organiser kister i kategorier (fx Woods, Blocks, Plants)
- **Søgning** - Find items hurtigt blandt 1.400+ Minecraft items (kurateret survival-liste)
- **Visninger** - Skift mellem grid og liste for både sidebar og kister
- **Kistehøjde** - Lav / Mellem / Høj / Fri (vokser med indholdet)
- **Chest icons** - Tilpas kiste-ikoner med alle Minecraft billeder
- **Klik til kiste** - Klik på kiste-nummeret i sidebaren for at hoppe til kisten

### Profiler & Deling
- **Import/Export** - Gem profiler som JSON-filer
- **URL-deling** - Del profiler via link; profilen indlæses automatisk når linket åbnes
- **Kopiér kode** - Del profiler som kompakt, URL-safe kode-streng (deflate + base64url)
- **Skabeloner** - Brug færdige skabeloner (fx "Ivers Kisterum" med alle items fordelt på 156 kister)
- **Undo/Redo** - Fortryd handlinger med Ctrl+Z / Ctrl+Y

### Chest Features
- **Auto-navngivning** - Kister navngives automatisk efter første item
- **Kommando-kopiering** - Et-klik kopiering af signedit-kommandoen
- **Tegn-tæller** - Se antal tegn (max 256 for Minecraft signs)
- **Markér som færdig** - Markér kister som færdige med checkbox
- **Hurtig sletning** - Shift-klik på slet-krydset springer bekræftelsen over

## Tech Stack

| Pakke | Beskrivelse |
|-------|-------------|
| SolidJS | UI framework (fine-grained reaktivitet, ingen VDOM) |
| TypeScript | Type safety |
| Vite | Build tool og dev server |
| Tailwind CSS 4 | Utility-first styling |
| @thisbeyond/solid-dnd | Drag-and-drop |
| pako | Kompression til delings-koder |

## Projektstruktur

```
src/
├── components/      # UI-komponenter (AppShell, Sidebar, Chest, TabBar...)
├── stores/          # Global state (app-store, drag-store)
├── dnd/             # Drag-and-drop-laget (ID-skema, collision, drag-handlers)
├── lib/             # Delt logik (item-katalog, profil-kodning)
├── scss/            # Stylesheets
├── data.json        # Item-katalog (kurateret, kun survival-items)
└── spriteMap.json   # Sprite-positioner for ikonerne
```

## Udvikling

```bash
npm install        # Installer dependencies
npm run dev        # Start dev server
npm run typecheck  # TypeScript-tjek
npm run build      # Byg til produktion (build/)
```

**Deploy:** hvert push til `master` bygger og deployer automatisk til GitHub Pages via
`.github/workflows/pages-build-deployment.yml`.

## Ikoner

Alle item-ikoner kommer fra [mc.nerothe.com](https://mc.nerothe.com/) (64x64, pr. Minecraft-version).

**Sådan opdateres ikonerne** (fx til en ny Minecraft-version):
1. Hent ikon-pakken (zip) fra [mc.nerothe.com](https://mc.nerothe.com/)
2. Filerne hedder `minecraft_<item>.png` - fjern `minecraft_`-prefixet og kopiér dem til `public/assets/images/icons/`
3. Tilføj de nye items i `src/data.json` ved siden af relaterede items (listen er kurateret: kun survival-items, grupperet i familier)
4. Kør `node scripts/generate-sprites.cjs` fra roden
5. Kør `ffmpeg -y -i public/assets/images/spritesheet.png -lossless 1 -compression_level 6 public/assets/images/spritesheet.webp`
6. Opdater evt. skabelonen `public/presets/ivers_kisterum.json` så nye items ligger i en passende kiste

Se også kommentaren i `scripts/generate-sprites.cjs`.
