# WALLWISE Production Deployment

Use GitHub as the source repository:

```text
https://github.com/surisir/wallwise.git
```

## Backend on Railway

Create a new Railway service from GitHub.

Recommended root directory:

```text
backend
```

Railway should use `backend/railway.json`, build with the backend Dockerfile, and expose `/health`.

If Railway was already created from the repository root, that also works now. The root `railway.json` uses `Dockerfile.railway` and builds only the backend service.

Set these Railway environment variables:

```dotenv
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
IMAGE_PROVIDER=cloudflare-flux
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_AI_TOKEN=your_workers_ai_token
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b
```

After Railway deploys, test:

```text
https://your-railway-backend-url/health
```

Expected response:

```json
{"status":"ok"}
```

## Frontend on Vercel

Create a new Vercel project from GitHub and set the root directory to:

```text
frontend
```

Vercel should use `frontend/vercel.json`.

Set this Vercel environment variable:

```dotenv
BACKEND_URL=https://your-railway-backend-url
```

The browser should keep calling relative URLs like:

```text
/api/backend/analyze
/api/backend/visualize
```

Next.js forwards those requests to `BACKEND_URL` server-side.

## Final Checks

- Upload and analyze a desktop JPEG.
- Upload and analyze an iPhone HEIC photo.
- Upload and analyze a PNG screenshot.
- Run AI visualization and confirm the generated result appears.
- In browser DevTools, confirm there are no requests to `localhost:4000`.
- Confirm backend secrets are only in Railway, not Vercel or GitHub.
