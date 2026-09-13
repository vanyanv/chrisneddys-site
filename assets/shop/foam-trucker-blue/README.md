# Foam Trucker — Blue: source photography

Drop the raw scans/photos here, then run:

```
pnpm images:shop
```

which runs `scripts/build-shop-images.mjs --in assets/shop/foam-trucker-blue --out public/shop/foam-trucker-blue`
and writes a 720px-wide `.webp` and a 200px-wide `-thumb.webp` for each file
below, named for the gallery view or authenticity image it belongs to. Those
two cuts are what `src/data/merch.ts` expects at `photoDir` once a view's
`photo` field is filled in.

## Expected files

All eight hat photos are 2400x2400 JPGs except the 3/4-with-sticker shot,
which is 4800x4800 — the conversion script resizes either down, so the
source resolution doesn't matter beyond "big enough."

| Source file                                              | Gallery view                                        |
| -------------------------------------------------------- | --------------------------------------------------- |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_STICKER_FRONT_1.jpg`     | `front` — FRONT, hero shot, /50 sticker on the bill |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_FRONT_1A.jpg`            | `front-plain` — FRONT, no bill sticker              |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_SIDE_STICKER_1LARGE.jpg` | `angle` — 3/4, /50 sticker on the bill (4800x4800)  |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_SIDE_1.jpg`              | `angle-plain` — 3/4, no bill sticker                |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_CLOSEUP_1B.jpg`          | `cyclops` — BUTTON close-up                         |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_CLOSEUP_1A.jpg`          | `stitch` — STITCH close-up                          |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_BACK_1A.jpg`             | `snap` — SNAP close-up                              |
| `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_BACK_1.jpg`              | `back` — BACK, full back                            |

Plus the authenticity section's two images. `sticker` is square, straight off
the scan. `certificate` is a portrait certificate sitting inside a 2400x2400
white field — `scripts/build-shop-images.mjs` crops it to the card's own edge
(the `CROP` table there) before resizing, so the published image is the card
itself, roughly 2:3, not the white square around it.

| Source file                                    | Authenticity image |
| ---------------------------------------------- | ------------------ |
| `CNE_WEB_IMAGES_RETAIL_HAT_COA_BLANK_1.jpg`    | `certificate`      |
| `CNE_WEB_IMAGES_RETAIL_HAT_STICKER_SOLO_1.jpg` | `sticker`          |

## Not expected

These exist among the raw scans but are not inputs to the build — leave them
out of this folder, or the script will still process them under their own
basename (see "Any other file" in `scripts/build-shop-images.mjs`):

- `CNE_WEB_IMAGES_RETAIL_HAT_BLUE_STICKER_FRONT_1LARGE.jpg` — a duplicate of
  `front`, at 4800x4800.
- `CNE_WEB_IMAGES_RETAIL_HAT_COA_BLANK_1A.jpg` — a filled-in sample certificate,
  not the blank one the real product ships with.
- `CNE_WEB_IMAGES_RETAIL_HAT_COA_BLANK_1.png` — the same image as the `.jpg`
  above, in a second format.

## Once the files are here

Uncomment the matching `photo` field on each view (and the `authenticity`
object) in `src/data/merch.ts` — `ProductShot` and the authenticity section
already know how to render them; `merch.ts` is what tells them a photo now
exists.
