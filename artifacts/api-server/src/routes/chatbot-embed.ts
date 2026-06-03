/**
 * Chatbot Embed Script
 *
 * Marketing sitelerinde HTML'in herhangi bir yerine şu tek satırı ekleyerek
 * Sphere Asistan chatbot widget'ını yükleyebilirsin:
 *
 *   <script src="https://app.sphereenglish.com/api/widget.js" async defer></script>
 *
 * Bu route, kendi kendine başlayan (IIFE) vanilla JS bundle döndürür.
 * Widget DOM'a kendisi inject olur, React veya başka bir frontend
 * framework'üne ihtiyaç duymaz. Tüm CSS inline.
 */

import { Router, type Request, type Response } from "express";

const router = Router();

// ─── Widget JavaScript Bundle ──────────────────────────────────────────
const WIDGET_JS = String.raw`(function(){
  'use strict';

  if (window.__sphereAsistanLoaded) return;
  window.__sphereAsistanLoaded = true;

  // ─── Konfigürasyon (script tag'inden override edilebilir) ────────────
  var currentScript = document.currentScript;
  var scriptOrigin = '';
  if (currentScript && currentScript.src) {
    try { scriptOrigin = new URL(currentScript.src).origin; } catch(e) {}
  }
  var API_BASE = (currentScript && currentScript.getAttribute('data-api')) || scriptOrigin || 'https://app.sphereenglish.com';
  var CHAT_URL = API_BASE.replace(/\/$/, '') + '/api/chat';
  var BRAND_COLOR = (currentScript && currentScript.getAttribute('data-color')) || '#082567';
  var SESSION_KEY = 'sphere_chat_session';
  var MESSAGES_KEY = 'sphere_chat_messages';

  // ─── State ───────────────────────────────────────────────────────────
  var INITIAL_MSG = {
    role: 'assistant',
    content: 'Merhaba! Ben Sphere Asistan. Kurumsal İngilizce, AI koçluğu veya platform hakkında her şeyi sorabilirsin. Nasıl yardımcı olabilirim?',
    timestamp: new Date().toISOString()
  };
  var state = {
    isOpen: false,
    loading: false,
    leadCaptured: false,
    hasUnread: false,
    messages: [INITIAL_MSG]
  };

  // ─── localStorage ─────────────────────────────────────────────────────
  function getSessionId() {
    try {
      var id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'sphere_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch(e) { return 'sphere_' + Date.now(); }
  }
  function loadMessages() {
    try {
      var raw = localStorage.getItem(MESSAGES_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) state.messages = parsed;
      }
    } catch(e) {}
  }
  function saveMessages() {
    try {
      if (state.messages.length > 1) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(state.messages));
      }
    } catch(e) {}
  }

  // ─── Stil yardımcısı ─────────────────────────────────────────────────
  function applyStyle(el, styles) {
    for (var k in styles) el.style[k] = styles[k];
  }
  function el(tag, styles, attrs) {
    var e = document.createElement(tag);
    if (styles) applyStyle(e, styles);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ─── DOM elemanları ──────────────────────────────────────────────────
  var rootEl, btnEl, panelEl, msgsEl, inputEl, sendBtnEl, badgeEl;

  function buildUI() {
    rootEl = el('div', {}, { id: 'sphere-asistan-root' });

    // Buton
    btnEl = el('button', {
      position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
      width: '60px', height: '60px', borderRadius: '50%',
      background: BRAND_COLOR, color: 'white', border: 'none', cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'transform 0.2s, box-shadow 0.2s',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }, { 'aria-label': 'Sohbeti aç' });
    btnEl.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btnEl.onmouseenter = function() { this.style.transform = 'scale(1.05)'; };
    btnEl.onmouseleave = function() { this.style.transform = 'scale(1)'; };
    btnEl.onclick = togglePanel;

    // Okunmamış bildirim noktası
    badgeEl = el('span', {
      position: 'absolute', top: '8px', right: '8px',
      width: '12px', height: '12px', borderRadius: '50%',
      background: '#ef4444', border: '2px solid white', display: 'none'
    });
    btnEl.appendChild(badgeEl);

    // Panel
    panelEl = el('div', {
      position: 'fixed', bottom: '96px', right: '24px', zIndex: '2147483646',
      width: '380px', maxWidth: 'calc(100vw - 48px)',
      height: '560px', maxHeight: 'calc(100vh - 120px)',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
      display: 'none', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Header
    var header = el('div', {
      background: BRAND_COLOR, color: 'white', padding: '16px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    });
    var headerInfo = el('div');
    headerInfo.innerHTML =
      '<div style="font-weight:600;font-size:16px;">Sphere Asistan</div>' +
      '<div style="font-size:12px;opacity:0.8;margin-top:2px;">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:6px;"></span>' +
        'Çevrimiçi · Hemen yanıtlıyor</div>';
    var clearBtn = el('button', {
      background: 'transparent', border: 'none',
      color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '4px'
    }, { title: 'Sohbeti temizle', 'aria-label': 'Sohbeti temizle' });
    clearBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    clearBtn.onclick = clearChat;
    header.appendChild(headerInfo);
    header.appendChild(clearBtn);

    // Mesajlar alanı
    msgsEl = el('div', {
      flex: '1', overflowY: 'auto', padding: '16px 20px', background: '#f8f9fb'
    });

    // Input alanı
    var inputArea = el('div', {
      borderTop: '1px solid #e5e7eb', padding: '12px', background: 'white'
    });
    var inputRow = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px' });
    inputEl = el('textarea', {
      flex: '1', border: '1px solid #e5e7eb', borderRadius: '8px',
      padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none',
      fontFamily: 'inherit', lineHeight: '1.4', maxHeight: '120px'
    }, { placeholder: 'Sorunu yaz...', rows: '1' });
    inputEl.onfocus = function() { this.style.borderColor = BRAND_COLOR; };
    inputEl.onblur = function() { this.style.borderColor = '#e5e7eb'; };
    inputEl.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    inputEl.oninput = function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    };
    sendBtnEl = el('button', {
      background: '#cbd5e1', color: 'white', border: 'none',
      borderRadius: '8px', width: '36px', height: '36px', cursor: 'not-allowed',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'
    }, { 'aria-label': 'Gönder' });
    sendBtnEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    sendBtnEl.onclick = sendMessage;
    inputRow.appendChild(inputEl);
    inputRow.appendChild(sendBtnEl);
    var footer = el('div', {
      marginTop: '6px', fontSize: '11px', color: '#9ca3af', textAlign: 'center'
    });
    footer.textContent = 'Sphere Asistan AI ile çalışır · Önemli kararlar için insan danışmanımıza danışın';
    inputArea.appendChild(inputRow);
    inputArea.appendChild(footer);

    panelEl.appendChild(header);
    panelEl.appendChild(msgsEl);
    panelEl.appendChild(inputArea);

    rootEl.appendChild(btnEl);
    rootEl.appendChild(panelEl);
    document.body.appendChild(rootEl);

    inputEl.addEventListener('input', updateSendBtn);
  }

  function updateSendBtn() {
    var hasText = inputEl.value.trim().length > 0;
    var enabled = hasText && !state.loading;
    sendBtnEl.style.background = enabled ? BRAND_COLOR : '#cbd5e1';
    sendBtnEl.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  function renderMessages() {
    msgsEl.innerHTML = '';
    state.messages.forEach(function(m) {
      var wrap = el('div', {
        display: 'flex',
        flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
        marginBottom: '12px'
      });
      var bubble = el('div', {
        maxWidth: '80%', padding: '10px 14px',
        borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: m.role === 'user' ? BRAND_COLOR : 'white',
        color: m.role === 'user' ? 'white' : '#1f2937',
        fontSize: '14px', lineHeight: '1.5',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        boxShadow: m.role === 'assistant' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
      });
      bubble.textContent = m.content;
      wrap.appendChild(bubble);
      msgsEl.appendChild(wrap);
    });

    if (state.loading) {
      var typing = el('div', { display: 'flex', marginBottom: '12px' });
      typing.innerHTML = '<div style="padding:12px 14px;border-radius:16px 16px 16px 4px;background:white;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:sphereBlink 1.4s infinite both;"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:sphereBlink 1.4s infinite 0.2s both;"></span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin:0 2px;animation:sphereBlink 1.4s infinite 0.4s both;"></span></div>';
      msgsEl.appendChild(typing);
    }

    if (state.leadCaptured) {
      var note = el('div', {
        margin: '8px 0', padding: '10px 14px',
        background: '#dcfce7', color: '#166534',
        borderRadius: '12px', fontSize: '13px', textAlign: 'center'
      });
      note.textContent = '✓ Bilgilerin alındı. En kısa sürede dönüş yapacağız.';
      msgsEl.appendChild(note);
    }

    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function togglePanel() {
    state.isOpen = !state.isOpen;
    panelEl.style.display = state.isOpen ? 'flex' : 'none';
    if (state.isOpen) {
      state.hasUnread = false;
      badgeEl.style.display = 'none';
      setTimeout(function() { inputEl && inputEl.focus(); }, 50);
      renderMessages();
    }
  }

  function clearChat() {
    if (!confirm('Sohbet geçmişini silmek istediğinden emin misin?')) return;
    state.messages = [INITIAL_MSG];
    state.leadCaptured = false;
    try { localStorage.removeItem(MESSAGES_KEY); } catch(e) {}
    renderMessages();
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || state.loading) return;

    state.messages.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
    inputEl.value = '';
    inputEl.style.height = 'auto';
    state.loading = true;
    updateSendBtn();
    renderMessages();
    saveMessages();

    fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages,
        sessionId: getSessionId(),
        pageUrl: window.location.href
      })
    })
      .then(function(res) {
        if (!res.ok) return res.json().then(function(e) { throw new Error(e.error || 'Hata'); });
        return res.json();
      })
      .then(function(data) {
        state.messages.push({
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString()
        });
        if (data.capturedLead) state.leadCaptured = true;
        if (!state.isOpen) {
          state.hasUnread = true;
          badgeEl.style.display = 'block';
        }
      })
      .catch(function(err) {
        state.messages.push({
          role: 'assistant',
          content: 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen birazdan tekrar deneyin veya iletişim formunu kullanın: https://www.sphereenglish.com/iletisim',
          timestamp: new Date().toISOString()
        });
      })
      .then(function() {
        state.loading = false;
        updateSendBtn();
        renderMessages();
        saveMessages();
      });
  }

  // ─── CSS keyframes inject ────────────────────────────────────────────
  function injectStyles() {
    var styleEl = document.createElement('style');
    styleEl.textContent =
      '@keyframes sphereBlink{0%,100%{opacity:0.3}50%{opacity:1}}' +
      '@media (max-width:480px){' +
        '#sphere-asistan-root > div:last-child{width:calc(100vw - 32px)!important;right:16px!important;bottom:88px!important;}' +
        '#sphere-asistan-root > button{bottom:16px!important;right:16px!important;}' +
      '}';
    document.head.appendChild(styleEl);
  }

  // ─── Başlat ──────────────────────────────────────────────────────────
  function init() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    injectStyles();
    loadMessages();
    buildUI();
    updateSendBtn();
  }

  init();
})();`;

// ─── Route: GET /api/widget.js ───────────────────────────────────────
router.get("/widget.js", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5dk cache
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Cross-origin embed için CORP/COEP override - helmet'in default same-origin'ini ezer
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.removeHeader("X-Frame-Options");
  res.send(WIDGET_JS);
});

// İsteğe bağlı kolaylık: HTML preview için bir test sayfası
router.get("/widget.html", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>Sphere Asistan Test</title></head>
<body style="font-family:system-ui;padding:40px;">
<h1>Widget Test Sayfası</h1>
<p>Sağ alt köşede chatbot görmen lazım. Tıkla, soru sor.</p>
<script src="/api/widget.js" async defer></script>
</body></html>`);
});

export default router;
