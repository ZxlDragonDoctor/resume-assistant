# Web logo redesign

## Goal

Replace the current hand-drawn web logo with the plush bubble-dragon illustration selected by the user. Keep the website playful and recognizable while retaining the existing indigo and violet brand colors.

## Approved visual direction

- Use the selected transparent PNG: a soft plush purple dragon with expressive eyes, bubbles, and a blank resume card.
- Keep the Chinese wordmark `晓龙简历` as live text beside the mark where it already appears.
- Use the same mascot artwork as the source for web and installed-app icon sizes so the brand stays consistent.
- Preserve enough contrast in the login page's purple panel by placing the mascot on a light translucent tile instead of recoloring the artwork white.

## Touchpoints

- `Logo.tsx`: render the mascot image at the requested size in the navigation, footer, and login page.
- `frontend/public/logo.png`: store the selected artwork and continue using it for the Open Graph image.
- Browser and installed-app icons: regenerate `favicon.ico`, its PNG sizes, `apple-touch-icon.png`, `icon-192.png`, and `icon-512.png` from the raster mascot. Keep an opaque light tile behind the artwork at favicon sizes so its purple silhouette stays visible.
- `site.webmanifest` and `index.html`: point browser and PWA metadata at the regenerated assets. Do not advertise the old vector favicon.
- `gen-brand-icons.mjs` and the asset preview generator: make the selected PNG the reproducible source for the raster icon family and update preview labels that still describe the old vector mascot.

## Out of scope

- Do not change the wordmark, site colors, page copy, resume templates, or backend services.
- Leave the independent documentation banner artwork unchanged.

## Review criteria

- The selected mascot is visible against both the normal white UI and the login page's purple panel.
- At 16, 24, 28, and 34 pixels, the head, horns, and resume-card silhouette remain recognizable; simplify the favicon composition if needed while retaining the same character.
- The manifest, metadata, browser tab icon, and in-page logo all use the new mascot family.
- Icon generation can be repeated from the checked-in raster source without restoring the previous SVG artwork.

## Implementation notes

The selected source is the user's attached version of generated variant 2 (`codex-clipboard-3faef730-6b91-49e2-9640-6f0038c35489.png`). Keep that source image unchanged when copying it into the frontend assets. Generate derived icon files from a copy or in-memory buffer.
