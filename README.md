# fin-explorer

Interactive financial news topic cluster explorer.
Built with **Vite 5** + **React 18** + **TypeScript** + **D3.js**.

## Project structure

```
sec-edgar-vite/
├── public/
│   └── data/
│       ├── topics_recent.json   # Recent news clusters (default view)
│       └── topics_full.json     # Full historical clusters
├── src/
│   ├── components/
│   │   ├── CirclePacking.tsx    # D3 circle packing visualization
│   │   ├── TopicsTab.tsx        # Topics view — data loading, legend, stats
│   │   └── PlaceholderTab.tsx   # Stub for upcoming tabs
│   ├── App.tsx                  # Tab shell (Topics, Sentiment, Graph, EDGAR)
│   ├── main.tsx                 # React entry point
│   └── index.css                # Design tokens and global styles
├── vite.config.ts               # Base path config for GitHub Pages
└── tsconfig.json
```

## Local development

```bash
bun install
bun dev           # → http://localhost:5173
bun run build     # Type-check then build to dist/
bun run preview   # Preview production build locally
```

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<you>/sec-edgar-vite.git
git push -u origin main
```

Then: **GitHub repo → Settings → Pages → Source → GitHub Actions**

Live at: `https://<you>.github.io/sec-edgar-vite/`

> If you rename the repo, update `VITE_BASE_PATH` in the workflow to match the new repo name.
