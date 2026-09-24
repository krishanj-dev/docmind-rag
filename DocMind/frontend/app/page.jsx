'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icons';
import { API_URL, getHealth, splitSources, streamAnswer, uploadPdf } from '../lib/api';

const suggestions = [
  'Summarize the main ideas',
  'What are the key definitions?',
  'Explain this in simple words',
];

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState('checking');
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!API_URL) { setHealth('setup'); return; }
    const controller = new AbortController();
    getHealth(controller.signal).then(() => setHealth('online')).catch(() => {
      if (!controller.signal.aborted) setHealth('offline');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function addFiles(files) {
    const selected = Array.from(files || []);
    if (!selected.length || uploading) return;
    setError('');
    setUploading(true);
    try {
      for (const file of selected) {
        if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error(`${file.name}: choose a PDF file.`);
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: the maximum size is 5 MB.`);
        const result = await uploadPdf(file);
        setDocuments(current => [...current, { name: result.filename, chunks: result.chunks, id: crypto.randomUUID() }]);
      }
      setHealth('online');
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function ask(text = question) {
    const trimmed = text.trim();
    if (!trimmed || asking || !documents.length) return;
    const id = crypto.randomUUID();
    setQuestion('');
    setError('');
    setMessages(current => [...current, { role: 'user', text: trimmed, id: `${id}-user` }, { role: 'assistant', text: '', id }]);
    setAsking(true);
    try {
      await streamAnswer(trimmed, chunk => {
        setMessages(current => current.map(message => message.id === id ? { ...message, text: message.text + chunk } : message));
      });
    } catch (err) {
      setMessages(current => current.map(message => message.id === id ? { ...message, text: `Could not answer: ${err.message}` } : message));
      setHealth('offline');
    } finally {
      setAsking(false);
    }
  }

  function drop(event) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const connected = health === 'online';

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Icon name="spark" size={22}/></div><div><strong>docmind</strong><span>YOUR DOCUMENT SPACE</span></div></div>
      <div className="sidebar-content">
        <p className="section-label">WORKSPACE</p>
        <button className="nav-active" type="button"><Icon name="document" size={18}/> Document chat <span className="nav-dot" /></button>
        <div className="library-heading"><p className="section-label">YOUR DOCUMENTS</p><span>{documents.length}</span></div>
        {documents.length ? <div className="document-list">{documents.map(doc => <div className="document-item" key={doc.id} title={doc.name}><span className="pdf-icon">PDF</span><span className="document-info"><strong>{doc.name}</strong><small>{doc.chunks} text chunks</small></span><Icon name="check" size={16}/></div>)}</div> : <div className="library-empty">Your uploaded PDFs will appear here.</div>}
        <button className="sidebar-upload" type="button" disabled={uploading || !API_URL} onClick={() => inputRef.current?.click()}><Icon name="upload" size={18}/>{uploading ? 'Uploading...' : 'Add a PDF'}</button>
      </div>
      <div className="sidebar-footer"><div className="footer-avatar">K</div><div><strong>My workspace</strong><small>PDF research assistant</small></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}><Icon name="menu"/></button><span>Workspace</span><span className="crumb">/</span><strong>Document chat</strong></div><div className={`connection ${connected ? 'connected' : ''}`}><span className="status-dot" />{health === 'checking' ? 'Connecting' : health === 'online' ? 'Backend online' : health === 'setup' ? 'Setup needed' : 'Backend offline'}</div></header>

      <section className="chat-area">
        <div className="chat-width">
          {!messages.length && <div className="welcome"><div className="eyebrow"><span className="eyebrow-line"/> YOUR AI DOCUMENT COMPANION</div><div className="hero-icon"><Icon name="spark" size={30}/></div><h1>Understand your documents,<br/><em>one question at a time.</em></h1><p className="lead">Upload a PDF, ask anything about it, and get a clear answer with references to the pages it came from.</p>
            <div className={`dropzone ${dragging ? 'dropzone-drag' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><div className="drop-icon"><Icon name="upload" size={23}/></div><div><strong>{uploading ? 'Reading your document...' : 'Drop your PDF here'}</strong><p>or choose a file from your computer</p></div><button type="button" className="browse-btn" disabled={uploading || !API_URL} onClick={() => inputRef.current?.click()}>{uploading ? 'Uploading...' : 'Browse files'} <Icon name="arrow" size={16}/></button><small>PDF only · Up to 5 MB · Text-based documents</small></div>
            {!!documents.length && <div className="suggestions"><span>TRY ASKING</span><div>{suggestions.map(item => <button key={item} onClick={() => ask(item)} disabled={asking}>{item}<Icon name="arrow" size={14}/></button>)}</div></div>}
          </div>}
          {!!messages.length && <div className="conversation"><div className="conversation-heading"><span className="eyebrow">DOCUMENT CONVERSATION</span><h2>Ask your documents</h2><p>Answers are drawn from the PDF excerpts your backend retrieves.</p></div>{messages.map(message => {
            const { answer, sources } = message.role === 'assistant' ? splitSources(message.text) : { answer: message.text, sources: [] };
            return <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'assistant' ? <Icon name="spark" size={16}/> : 'Y'}</div><div className="message-content"><strong>{message.role === 'assistant' ? 'DocMind' : 'You'}</strong><div className="message-text">{answer || (asking && message === messages[messages.length - 1] ? <span className="thinking">Searching your documents<span>...</span></span> : '')}</div>{sources.length > 0 && <div className="sources"><span>REFERENCES</span>{sources.map(source => <span className="source-pill" key={source}><Icon name="document" size={14}/>{source}</span>)}</div>}</div></article>;
          })}<div ref={bottomRef}/></div>}
        </div>
      </section>
      <div className="composer-wrap"><div className="composer-inner">{error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16}/></button></div>}{health === 'setup' && <div className="setup-banner">Add your Colab ngrok URL to <code>.env.local</code> as <code>NEXT_PUBLIC_RAG_API_URL</code>, then restart Next.js.</div>}{health === 'offline' && <div className="setup-banner">Cannot reach the backend. Check that Colab and the ngrok tunnel are still running.</div>}<form className="composer" onSubmit={event => { event.preventDefault(); ask(); }}><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder={documents.length ? 'Ask a question about your documents...' : 'Upload a PDF to start asking questions...'} rows={1} disabled={!documents.length || asking} aria-label="Your question"/><button type="submit" aria-label="Send question" disabled={!question.trim() || !documents.length || asking}><Icon name="send" size={19}/></button></form><p className="composer-note">Answers are based on retrieved PDF excerpts. Check the original document for important details.</p></div></div>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={event => addFiles(event.target.files)}/>
    </main>
  </div>;
}
