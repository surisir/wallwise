# Wallwise MVP

Wallwise is a local MVP for visualizing a new paint color on walls in a room photo. It uses AI once to identify common objects and room surfaces, then does all wall selection and recoloring immediately in the browser.

## Architecture

- `frontend/` — Next.js, TypeScript, Tailwind, and an HTML Canvas editor.
- `backend/` — FastAPI image-analysis API using Ultralytics YOLO and a Hugging Face ADE20K SegFormer model.
- Uploaded bytes are validated, decoded, and processed in memory; the app does not persist original uploads.
- The API returns lossless, base64-encoded grayscale PNG masks. This keeps the payload substantially smaller than pixel JSON and is easy for the browser to decode once and cache.

`RoomSegmentationService` is the single model adapter to replace when a stronger segmentation or wall-instance model is introduced. `WallRegionService` uses connected components as the MVP wall-instance strategy: disconnected wall areas become `wall-1`, `wall-2`, etc. Touching walls may remain one selectable region.

## Prerequisites

- Node.js 20.9+ and npm (or pnpm)
- Python 3.10–3.12
- Internet access the first time models are used

## Run locally

Start the backend in one terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate with `source .venv/bin/activate`.

Start the frontend in another terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend uses `NEXT_PUBLIC_API_URL`, which defaults to `http://localhost:8000`.

## API

`GET /health` returns `{ "status": "ok" }`.

`POST /analyze` accepts `multipart/form-data` with an `image` field. JPG, JPEG, PNG, and WEBP are accepted up to 10 MB. It returns image dimensions, YOLO object boxes, individual wall masks, and available floor/ceiling/window/door masks. An invalid file returns a useful 4xx response; model or download failure returns a 503 without exposing server details.

`POST /visualize` accepts the original image plus `color_hex` and optional `color_name` as multipart fields. It sends the original upload and edit prompt to Google AI Studio's Gemini image API from the backend, then streams Gemini's returned image bytes back to the browser. It does not use a browser canvas, CSS tint, or pixel-overlay recoloring as the final visualization.

Local development CORS is explicitly limited by `ALLOWED_ORIGINS` (default `http://localhost:3000`); set it to the deployed frontend origin in production.

## Model downloads

The application lazily initializes models on the first `/analyze` request and reuses them for later requests. The default `nvidia/segformer-b5-finetuned-ade-640-640` trades a larger first download and slower CPU inference for better indoor-wall boundaries; the YOLO nano checkpoint is roughly 5–10 MB. Framework dependencies, especially PyTorch, are much larger and platform-dependent. Downloads are stored in the normal Hugging Face/Ultralytics caches, not in uploaded-image storage.

If a first analysis fails, verify internet access, PyTorch installation, and the model names in `backend/.env`. Set `ENABLE_OBJECT_DETECTION=false` to keep the core wall workflow running while diagnosing YOLO.

## Gemini image-editing setup

Copy `backend/.env.example` to `backend/.env` and set the server-only key:

```dotenv
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=your_server_side_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Never place this key in `frontend/.env.local` or any `NEXT_PUBLIC_*` variable. After restarting the backend, upload a room, choose a color, open **Color**, and choose **Visualize with AI**. The original upload—not a canvas preview—is sent to the backend, and Gemini's returned image appears in the existing before/after control. The response includes `X-Image-Provider`, `X-Generation-Time-Ms`, `X-Image-Width`, and `X-Image-Height` headers for diagnostics.

## Wall-analysis workflow

The local segmentation is retained for wall selection and editing guidance. The actual visualized image is always the remote Qwen edit returned by fal. The dynamic server-side prompt includes the selected color name, HEX, and RGB along with strict preservation rules for furniture, windows, trim, ceiling, flooring, plants, artwork, lighting, shadows, perspective, composition, and room architecture.

The editor also supports wall hover/click selection, color swatches and custom hex colors, optional YOLO boxes, before/after, undo (last 20 changes), reset wall, and reset all. Coordinates are translated from the responsive CSS canvas back to natural image pixels before mask lookup.

## Checks

```powershell
cd frontend
npm run typecheck
npm run build

cd ..\backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

## MVP limitations

- Semantic segmentation can miss walls or merge touching walls.
- Furniture, doors, windows, unusual lighting, and complex wall textures can make boundaries less accurate.
- The current model protects door and window semantic masks from recoloring, but it is not physically accurate paint simulation.
- Final paint appearance depends on real lighting, paint finish, camera processing, and wall condition.

For a commercial version, replace `RoomSegmentationService` with an indoor wall-instance model, add mask-refinement tools, and validate the renderer against calibrated paint and lighting references.
