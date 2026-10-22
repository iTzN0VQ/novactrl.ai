/* ============================================
   NovaBot — site chat widget
   Uses Cloudflare Workers AI (free tier)
   ============================================ */
(function () {
  'use strict';

  // ────────────────────────────────────────────
  // CONFIG
  // Replace this URL after deploying the worker.
  // Until then the widget shows a "Coming soon" message.
  // ────────────────────────────────────────────
  const WORKER_URL = window.NOVABOT_WORKER_URL || '';

  const GREETING =
    "Hey — I'm Nova Claw, NovaCTRL's HVAC diagnostic AI. " +
    "Give me a brand and error code, or describe what the system is doing. " +
    "I work best one question at a time.";

  const PLACEHOLDER_REPLY =
    "I'm not wired up to the AI backend yet — Riz is still deploying the worker. " +
    "For now, browse the tech tips or shoot an email to rizvanfazli8@gmail.com.";

  // ────────────────────────────────────────────
  // STATE
  // ────────────────────────────────────────────
  let isOpen = false;
  let isSending = false;
  const history = []; // [{role: 'user'|'assistant', content}]

  // ────────────────────────────────────────────
  // ELEMENTS (built once on init)
  // ────────────────────────────────────────────
  let elRoot, elBtn, elPanel, elMessages, elInput, elForm, elStatus;

  // ────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    buildDOM();
    bindEvents();
    addMessage('assistant', GREETING);
  }

  function buildDOM() {
    elRoot = document.createElement('div');
    elRoot.id = 'novabot-root';
    elRoot.innerHTML = `
      <button id="novabot-btn" aria-label="Open Nova Claw chat" title="Ask Nova Claw">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span class="novabot-btn-label">Nova Claw</span>
      </button>

      <section id="novabot-panel" role="dialog" aria-label="Nova Claw chat" aria-hidden="true">
        <header class="novabot-header">
          <div class="novabot-id">
            <span class="novabot-avatar">N</span>
            <div>
              <strong>Nova Claw</strong>
              <span class="novabot-sub">NovaCTRL's HVAC diagnostic AI</span>
            </div>
          </div>
          <button id="novabot-close" aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        <div id="novabot-messages" role="log" aria-live="polite" aria-atomic="false"></div>

        <div id="novabot-status" aria-live="polite"></div>

        <form id="novabot-form" autocomplete="off">
          <textarea id="novabot-input" placeholder="Brand and code, or describe what's wrong..." rows="1" maxlength="2000"></textarea>
          <button type="submit" id="novabot-send" aria-label="Send message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>

        <div class="novabot-foot">
          Nova Claw can be wrong. For deep diagnostics use the full NovaCTRL app. Never bypass safety switches.
        </div>
      </section>
    `;
    document.body.appendChild(elRoot);

    elBtn = elRoot.querySelector('#novabot-btn');
    elPanel = elRoot.querySelector('#novabot-panel');
    elMessages = elRoot.querySelector('#novabot-messages');
    elInput = elRoot.querySelector('#novabot-input');
    elForm = elRoot.querySelector('#novabot-form');
    elStatus = elRoot.querySelector('#novabot-status');
  }

  function bindEvents() {
    elBtn.addEventListener('click', toggle);
    elRoot.querySelector('#novabot-close').addEventListener('click', close);
    elForm.addEventListener('submit', onSubmit);

    // Auto-resize textarea
    elInput.addEventListener('input', () => {
      elInput.style.height = 'auto';
      elInput.style.height = Math.min(elInput.scrollHeight, 120) + 'px';
    });

    // Enter to send, Shift+Enter for newline
    elInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isSending) elForm.requestSubmit();
      }
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });
  }

  // ────────────────────────────────────────────
  // PANEL OPEN / CLOSE
  // ────────────────────────────────────────────
  function toggle() { isOpen ? close() : open(); }

  function open() {
    isOpen = true;
    elPanel.setAttribute('aria-hidden', 'false');
    elPanel.classList.add('open');
    elBtn.classList.add('open');
    setTimeout(() => elInput.focus(), 200);
  }

  function close() {
    isOpen = false;
    elPanel.setAttribute('aria-hidden', 'true');
    elPanel.classList.remove('open');
    elBtn.classList.remove('open');
  }

  // ────────────────────────────────────────────
  // MESSAGING
  // ────────────────────────────────────────────
  async function onSubmit(e) {
    e.preventDefault();
    const text = elInput.value.trim();
    if (!text || isSending) return;

    elInput.value = '';
    elInput.style.height = 'auto';

    addMessage('user', text);
    history.push({ role: 'user', content: text });

    if (!WORKER_URL) {
      // No backend wired up yet
      setTimeout(() => addMessage('assistant', PLACEHOLDER_REPLY), 400);
      history.push({ role: 'assistant', content: PLACEHOLDER_REPLY });
      return;
    }

    isSending = true;
    setStatus('Nova Claw is thinking…');
    const pendingId = addMessage('assistant', '', true);

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      if (!res.ok) throw new Error('Worker returned ' + res.status);
      const data = await res.json();
      const reply = (data && (data.reply || data.response || data.content)) || 'No response.';

      replaceMessage(pendingId, reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      replaceMessage(
        pendingId,
        "I couldn't reach the AI backend. Try again in a moment, or reach out at rizvanfazli8@gmail.com."
      );
      console.error('[NovaBot]', err);
    } finally {
      isSending = false;
      setStatus('');
    }
  }

  function addMessage(role, content, pending) {
    const id = 'm' + Math.random().toString(36).slice(2, 9);
    const div = document.createElement('div');
    div.className = 'novabot-msg novabot-msg-' + role + (pending ? ' pending' : '');
    div.dataset.id = id;
    if (pending) {
      div.innerHTML = '<span class="novabot-dots"><i></i><i></i><i></i></span>';
    } else {
      div.innerHTML = formatMarkdown(content);
    }
    elMessages.appendChild(div);
    elMessages.scrollTop = elMessages.scrollHeight;
    return id;
  }

  function replaceMessage(id, content) {
    const div = elMessages.querySelector('[data-id="' + id + '"]');
    if (!div) return;
    div.classList.remove('pending');
    div.innerHTML = formatMarkdown(content);
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  function setStatus(text) {
    elStatus.textContent = text;
  }

  // ────────────────────────────────────────────
  // VERY LIGHT MARKDOWN — bold, italic, code, paragraphs, lists, links
  // (escape first; then apply transforms)
  // ────────────────────────────────────────────
  function formatMarkdown(raw) {
    let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // code blocks ```...```
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => '<pre><code>' + code.trim() + '</code></pre>');
    // inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bold **x**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic *x*
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // line breaks → paragraphs / lists
    const lines = s.split(/\r?\n/);
    const out = [];
    let inList = null; // 'ul' or 'ol'
    for (let line of lines) {
      const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      if (olMatch) {
        if (inList !== 'ol') { if (inList) out.push('</' + inList + '>'); out.push('<ol>'); inList = 'ol'; }
        out.push('<li>' + olMatch[2] + '</li>');
      } else if (ulMatch) {
        if (inList !== 'ul') { if (inList) out.push('</' + inList + '>'); out.push('<ul>'); inList = 'ul'; }
        out.push('<li>' + ulMatch[1] + '</li>');
      } else if (line.trim() === '') {
        if (inList) { out.push('</' + inList + '>'); inList = null; }
      } else {
        if (inList) { out.push('</' + inList + '>'); inList = null; }
        out.push('<p>' + line + '</p>');
      }
    }
    if (inList) out.push('</' + inList + '>');
    return out.join('');
  }
})();
