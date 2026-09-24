# DocMind — free month demo

Next.js frontend + FastAPI PDF RAG backend. The hosted backend is designed for Render's 512 MB free service: it uses lightweight TF-IDF retrieval and Groq generation. The original Colab notebook uses SBERT and Chroma; it remains a separate prototype. **Do not describe the hosted version as SBERT or Chroma.**

## 1. Push to GitHub from Windows

Extract this ZIP. Open the **DocMind_GitHub_Deploy** folder in VS Code (the folder with `frontend`, `backend` and this README). Create a new **empty** GitHub repository called `docmind-rag` at https://github.com/new. Do not select “Add a README”, `.gitignore`, or license there. Then in the VS Code terminal:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Initial DocMind frontend and API"
git remote add origin https://github.com/YOUR_USERNAME/docmind-rag.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. If Git asks you to sign in, complete its browser login. Before committing, `git status` must **not** show `.env.local`, PDF files, Groq keys, ngrok tokens, `node_modules`, or `.next`. The root `.gitignore` excludes them. Never upload your key in a notebook with saved outputs.

## 2. Deploy backend on Render Free

1. Go to https://dashboard.render.com/ and create a **Web Service** from your GitHub repository.
2. Choose **Free** instance, **Python** runtime, and **Root Directory** `backend`.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn rag_api:app --host 0.0.0.0 --port $PORT`
5. Add environment variable `GROQ_API_KEY` with your **new private Groq API key**. Never put it in GitHub or Vercel's public frontend variables.
6. Deploy. Visit `https://YOUR-SERVICE.onrender.com/health`. The first request after idle may take around a minute.

No ngrok token is needed for Render. This service has no login and a shared in-memory document collection. Upload only public sample PDFs. The service sleeps after inactivity; uploaded documents disappear on sleep, restart, or deploy. Reupload after it wakes. Free hosting is suitable for a one-month live demonstration, not guaranteed always-on availability or durable document storage.

## 3. Deploy frontend on Vercel Hobby

1. Go to https://vercel.com/new and import the same GitHub repository.
2. Set **Root Directory** to `frontend` and framework to Next.js.
3. Add environment variable `NEXT_PUBLIC_RAG_API_URL` with your Render URL **without** `/health` and **without** a trailing slash. Example: `https://YOUR-SERVICE.onrender.com`.
4. Deploy and copy the Vercel URL (e.g. `https://docmind-...vercel.app`). Public `NEXT_PUBLIC_` values are included in the browser bundle; only the public backend URL belongs here.

Vercel's free Hobby plan is intended for personal, non-commercial projects. Check plan terms if this becomes a company service.

## 4. Permit the Vercel frontend in your backend

In the Render service settings, add environment variable `FRONTEND_ORIGINS` containing the exact Vercel URL, e.g. `https://docmind-...vercel.app` (no trailing slash). Let Render redeploy. After it finishes, refresh your Vercel page and upload a PDF. If you also need another frontend domain, separate exact origins with commas.

## Test

- Render `/health` returns `status: ok`; zero chunks after idle is expected.
- Vercel header says **Backend online** after the backend wakes and a page refresh.
- Upload a small text-based PDF (5 MB or less), ask a specific question, see answer and source page.
- If Vercel says offline, visit Render `/health` to wake it, wait for it to respond, then refresh Vercel and upload again.

## Architecture and limits

`PDF → PyPDF extraction → overlapping text chunks → TF-IDF cosine retrieval → top three chunks → Groq GPT-OSS → streamed answer and source pages.`

The hosted backend keeps all users' documents in the same process. It has no authentication, user isolation, deletion, OCR, or permanent storage. Its browser document list shows files uploaded in that tab, and may be stale if Render restarts; refreshing the page clears that list. For a production app, add authentication, per-user storage, persistent vector storage, and monitoring.
