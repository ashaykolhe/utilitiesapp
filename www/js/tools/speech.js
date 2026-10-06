'use strict';
Tools.register({ id: 'tts', name: 'Text to Speech', icon: '🔊', cat: 'audio', desc: 'Read any text aloud with a choice of voice and speed.', needs: [], render(el) {
  if (!window.speechSynthesis) { el.innerHTML = '<p class="muted">Speech is not supported here.</p>'; return; }
  el.innerHTML = `<label class="f">Text to read<textarea id="t" rows="6" maxlength="5000" aria-label="Text to read aloud" placeholder="Type something to hear it"></textarea></label>
    <label class="f">Voice<select id="v" aria-label="Voice"></select></label>
    <label class="muted">Speed <input id="r" type="range" min="0.5" max="2" step="0.1" value="1" aria-label="Speech speed" style="width:100%"></label>
    <div class="row"><button class="btn" id="go">Speak</button><button class="btn alt" id="st">Stop</button></div>`;
  const fill = () => { const s = $('#v', el); if (!s) return; s.innerHTML = speechSynthesis.getVoices().map((v, i) => `<option value="${i}">${esc(v.name)} (${esc(v.lang)})</option>`).join(''); };
  fill(); speechSynthesis.onvoiceschanged = fill;
  $('#go', el).onclick = () => {
    const text = $('#t', el).value.trim();
    if (!text) { toast('Type some text first'); return; }
    const u = new SpeechSynthesisUtterance(text), v = speechSynthesis.getVoices()[$('#v', el).value];
    if (v) u.voice = v;
    u.rate = +$('#r', el).value; speechSynthesis.cancel(); speechSynthesis.speak(u);
  };
  $('#st', el).onclick = () => speechSynthesis.cancel();
  return () => { speechSynthesis.onvoiceschanged = null; speechSynthesis.cancel(); };
} });

Tools.register({ id: 'stt', name: 'Speech to Text', icon: '🎙️', cat: 'audio', desc: 'Speak and see your words as text, then copy them. Needs a device or WebView with speech recognition.', needs: ['microphone'], render(el) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  el.innerHTML = `<div class="muted center" id="msg" style="margin-bottom:6px"></div><label class="f">Recognised text<textarea id="t" rows="8" maxlength="20000" aria-label="Recognised text" placeholder="Your words appear here"></textarea></label>
    <div class="row"><button class="btn" id="go">Start listening</button><button class="btn alt" id="cp">Copy</button></div>`;
  const say = (t) => { const m = $('#msg', el); if (m) m.textContent = t; };
  const reset = () => { rec = null; const g = $('#go', el); if (g) g.textContent = 'Start listening'; };
  const ERR = { 'not-allowed': 'Microphone permission was denied. Allow it in your phone settings.', 'service-not-allowed': 'Speech recognition is turned off or not allowed on this device.', 'no-speech': 'No speech was heard. Try again and speak closer to the microphone.', 'audio-capture': 'No microphone was found.', 'network': 'Speech recognition needs a connection on this device and could not reach its service.', 'language-not-supported': 'This language is not supported for speech recognition.' };
  let rec = null;
  if (!SR) { say('Speech recognition is not available on this device or in this WebView, so this tool cannot listen.'); $('#go', el).disabled = true; }
  $('#go', el).onclick = () => {
    if (rec) { try { rec.stop(); } catch (e) { reset(); } return; }
    say('');
    try {
      const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = navigator.language || 'en-US';
      r.onresult = e => { const t = $('#t', el); if (!t) return; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t.value = (t.value + e.results[i][0].transcript + ' ').slice(0, 20000); };
      r.onend = reset;
      r.onerror = e => { say(ERR[e.error] || ('Speech recognition error: ' + e.error)); };
      rec = r; r.start(); $('#go', el).textContent = 'Stop';
    } catch (e) { reset(); say('Could not start speech recognition on this device.'); }
  };
  $('#cp', el).onclick = () => {
    const v = $('#t', el).value;
    if (!v) { toast('Nothing to copy'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(() => toast('Copied'), () => toast('Copy failed')); else toast('Copy failed');
  };
  return () => { const r = rec; rec = null; if (r) { r.onend = r.onerror = r.onresult = null; try { r.abort(); } catch (e) { /* ignore */ } } };
} });
