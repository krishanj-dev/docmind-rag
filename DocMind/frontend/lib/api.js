export const API_URL = (process.env.NEXT_PUBLIC_RAG_API_URL || '').replace(/\/$/, '');
const headers = { 'ngrok-skip-browser-warning': 'true' };

async function check(response) {
  if (response.ok) return response;
  let detail = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    detail = typeof body.detail === 'string' ? body.detail : detail;
  } catch { /* An HTML proxy error may not contain JSON. */ }
  throw new Error(detail);
}

export async function getHealth(signal) {
  return (await check(await fetch(`${API_URL}/health`, { headers, signal, cache: 'no-store' }))).json();
}

export async function uploadPdf(file) {
  const form = new FormData();
  form.append('file', file);
  return (await check(await fetch(`${API_URL}/upload`, {
    method: 'POST', headers, body: form,
  }))).json();
}

export async function streamAnswer(question, onText) {
  const response = await check(await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  }));
  if (!response.body) throw new Error('Your browser cannot read the answer stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      onText(decoder.decode(value, { stream: true }));
    }
    onText(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export function splitSources(value) {
  const marker = '\n\n[SOURCES] ';
  const position = value.indexOf(marker);
  if (position < 0) return { answer: value, sources: [] };
  return {
    answer: value.slice(0, position),
    sources: value.slice(position + marker.length).split(', ').filter(Boolean),
  };
}
