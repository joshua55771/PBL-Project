# Anatomy 3D – Study Atlas

Interactive 3D viewer: toggle bones, muscles, nerves, arteries and veins, and isolate body regions (head, neck, thorax, abdomen & pelvis, upper limb, lower limb). Click any structure to identify it.

## Run locally (VS Code)
1. Open this folder in VS Code.
2. Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

## Publish with GitHub Pages
1. Create a repository on GitHub and push this folder (`git init`, `git add .`, `git commit`, `git push`).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Your site appears at `https://<username>.github.io/<repo>/`.

## Models (from Z-Anatomy, CC BY-SA 4.0; derived from BodyParts3D, CC BY-SA 2.1 JP)
`models/` holds the real anatomy: `skeleton.glb`, `muscles_1-3.glb`, `nerves.glb`, `arteries.glb`, `veins.glb`, `organs.glb`. Nerves and vessels are drawn as tubes from the source curves. Keep the credit line on your site. Because the license is share-alike, your use of the model carries the same license.

Each object is named `system__region__Part_name` (systems: bone, cartilage, muscle, nerve, artery, vein, organ; regions: head, neck, thorax, abdpelvis, arm, leg). To add more GLBs, follow that naming and list the file in `MODEL_URLS` in `app.js`.

Systems load the first time you tick them (muscles are the biggest download, about 25 MB). Serve with Live Server or GitHub Pages (browsers block `file://` loading). The folder is about 48 MB; every file is under GitHub's 100 MB limit.

*For education only; not for clinical use.*
