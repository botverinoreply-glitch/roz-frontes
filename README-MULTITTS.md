# roz — Multi-TTS for Vercel

## Six requested technologies
- **Kokoro TTS (`kokoro-js`)**: actual local-browser generation using the Kokoro-82M ONNX model.
- **MeloTTS**: Python function at `/api/melo`.
- **Coqui TTS**: Python function at `/api/coqui`.
- **Transformers.js**: inference framework used by the browser Kokoro package.
- **ONNX Runtime Web**: execution runtime used by Transformers.js/Kokoro.
- **Web Speech API**: device voice playback fallback (playback only; no reliable file export API).

Transformers.js and ONNX Runtime are not separate TTS models or voice catalogues; they are framework/runtime layers. The downloadable audio paths are Kokoro, MeloTTS and Coqui. Device-native Web Speech is preview/playback only.

## Audio formats
- Kokoro, MeloTTS and Coqui can generate downloadable WAV and MP3.
- MP3 encoding uses `@breezystack/lamejs` in the browser; WAV is encoded in the browser too.
- Native Web Speech voices cannot be reliably exported as MP3/WAV by the standard browser API.

## Deploy on Vercel
1. Import this project into Vercel as a Vite project (`npm run build`, output `dist`).
2. The basic deploy includes Kokoro in the browser. Its ONNX model is downloaded from Hugging Face on first generation; no provider API key is needed.
3. To enable MeloTTS and Coqui Python functions, back up `requirements.txt` and rename `requirements-full.txt` to `requirements.txt`.
4. Set `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` in Vercel Environment Variables (Preview first, then Production after testing), and make sure Fluid Compute is enabled.
5. Redeploy. The Python functions will attempt to download model files on cold start. This can be slow and uses ephemeral function storage.

## Limits and caution
Vercel announced Large Functions up to 5GB package size in beta in June 2026, but CPU, memory, execution-duration, and request/response limits still apply. This is not a GPU server. Very long scripts may hit function timeouts. The included Melo/Coqui routes process each <= 4,300-character segment synchronously; for sustained public traffic, move to a durable queue + object storage and add rate limiting. Python package installation/model downloads on Vercel must be tested under the target plan before production.

The ZIP does not include model weights. Kokoro weights are fetched by the browser from Hugging Face. Melo and Coqui weights are downloaded by their libraries to ephemeral storage. For stability and cost control, production should use persistent model hosting and a job queue.

## Licences
- Kokoro model: Apache-2.0 (model card).
- MeloTTS code: MIT.
- Coqui TTS code: MPL-2.0, but each Coqui model has its own separate licence; check it before commercial use.
- `@breezystack/lamejs`: LGPL-3.0.
- Verify the licence of all model weights and dependencies before commercial launch.

## Development
```bash
npm install
npm run dev
```
Vercel Python routes should be tested via Vercel CLI (`vercel dev`) after configuring the full dependencies.
