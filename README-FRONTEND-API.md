# roz frontend — API connected

Set `VITE_ROZ_API_URL` to the backend's Vercel origin, without `/api`:
```env
VITE_ROZ_API_URL=https://YOUR-ROZ-API.vercel.app
```
In Vercel, add this variable to the frontend project and redeploy. The frontend requests `/api/voices` and `/api/generate` from that host.

In the backend Vercel project set `ROZ_ALLOWED_ORIGINS` to the frontend origin, e.g. `https://roz.vercel.app` (no path). For initial testing, `*` can be used temporarily.

The voice catalogue is loaded from the backend. Generation sends `{ engine, voice, text, format, speed }` and downloads the binary response. `both` downloads the ZIP returned by the API.

The FAQ and explanatory copy describe the user-facing benefits and no longer claim that roz does not use an API.
