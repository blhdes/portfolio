# Ale Gómez · Portfolio

One-page portfolio. Plain HTML + CSS + a little JavaScript, no build step.

## See it locally

Open `index.html` in a browser, or from Terminal:

```
open /Users/agomezu/Claude/portfolio/index.html
```

## Replace the placeholders

Every dashed box is a placeholder. To fill them:

1. **App screenshots** — put images in `assets/` and swap each
   `<div class="ph ph-phone">...</div>` in `index.html` for
   `<img src="assets/your-file.png" alt="Culla screenshot">`.
2. **Photos** — same idea in the Photography section
   (`ph-photo` boxes). 10 to 20 images total.
3. **Portrait** — the `ph-portrait` box in About.

The name, links and all text live in `index.html`. Colors and fonts are
CSS variables at the top of `css/style.css`.

## Publish (GitHub Pages, free)

1. Create a repository on GitHub (e.g. `portfolio`).
2. Push this folder to it.
3. In the repo: Settings → Pages → Source: `main` branch, root folder.
4. The site appears at `https://<username>.github.io/portfolio/`.

A custom domain can be added later in the same Pages settings.

## Project notes

The plan, bio drafts and roadmap live in the Obsidian vault:
`Obsidian/Projects/Portfolio/`.
