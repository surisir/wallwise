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

`POST /visualize` accepts the original image plus `color_hex`, optional `color_name`, selected wall guidance, and optional selected-wall mask guidance as multipart fields. It sends the original upload and strict repaint prompt to the configured server-side image provider, then streams the provider's returned image bytes back to the browser. It does not use a browser canvas, CSS tint, or pixel-overlay recoloring as the final visualization.

Local development CORS is explicitly limited by `ALLOWED_ORIGINS` (default `http://localhost:3000`); set it to the deployed frontend origin in production.

## Model downloads

The application lazily initializes models on the first `/analyze` request and reuses them for later requests. The default `nvidia/segformer-b0-finetuned-ade-512-512` keeps small CPU containers responsive. You can override `SEGMENTATION_MODEL` with a larger model such as `nvidia/segformer-b5-finetuned-ade-640-640` when the host has enough RAM and startup time. YOLO object detection is disabled by default for production responsiveness; set `ENABLE_OBJECT_DETECTION=true` when the host can comfortably load it. Framework dependencies, especially PyTorch, are much larger and platform-dependent. Downloads are stored in the normal Hugging Face/Ultralytics caches, not in uploaded-image storage.

If a first analysis fails, verify internet access, PyTorch installation, host memory, and the model names in `backend/.env`. Keep `ENABLE_OBJECT_DETECTION=false` to keep the core wall workflow running while diagnosing YOLO.

## Image-editing provider setup

Copy `backend/.env.example` to `backend/.env` and set one server-only provider. Production currently uses Cloudflare FLUX:

```dotenv
IMAGE_PROVIDER=cloudflare-flux
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_AI_TOKEN=your_workers_ai_token
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b
```

OpenAI GPT Image Edit can be tested without removing FLUX:

```dotenv
IMAGE_PROVIDER=openai-image
OPENAI_API_KEY=your_server_side_openai_key
OPENAI_IMAGE_MODEL=gpt-image-2
```

Gemini can also be selected when configured:

```dotenv
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=your_server_side_google_ai_studio_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Never place provider keys in `frontend/.env.local` or any `NEXT_PUBLIC_*` variable. After restarting the backend, upload a photo, choose a color, and click **Apply**. The original upload—not a canvas preview—is sent to the backend, and the provider's returned image appears in the existing before/after control. The response includes `X-Image-Provider`, `X-Generation-Time-Ms`, `X-Image-Width`, and `X-Image-Height` headers for diagnostics.

## Wall-analysis workflow

The local segmentation is retained for wall selection and editing guidance. The actual visualized image is always the remote provider output selected by `IMAGE_PROVIDER`. The dynamic server-side prompt includes the selected color name, HEX, RGB, wall-selection guidance, optional mask guidance, and strict preservation rules for furniture, windows, trim, ceiling, flooring, plants, artwork, lighting, shadows, perspective, composition, and architecture.

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
