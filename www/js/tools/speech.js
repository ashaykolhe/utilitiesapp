'use strict';
Tools.register({ id: 'tts', name: 'Text to Speech', icon: '🔊', cat: 'audio', desc: 'Read any text aloud with a choice of voice and speed.', needs: [], render(el) {
  if (!window.speechSynthesis) { el.innerHTML = '<p class="muted">Speech is not supported here.</p>'; return; }
  el.innerHTML = `<textarea id="t" rows="6" placeholder="Type something to hear it"></textarea><select id="v"></select>
    <label class="muted">Speed <input id="r" type="range" min="0.5" max="2" step="0.1" value="1" style="width:100%"></label>
    <div class="row"><button class="btn" id="go">Speak</button><button class="btn alt" id="st">Stop</button></div>`;
  const fill = () => { $('#v', el).innerHTML = speechSynthesis.getVoices().map((v, i) => `<option value="${i}">${esc(v.name)} (${esc(v.lang)})</option>`).join(''); };
  fill(); speechSynthesis.onvoiceschanged = fill;
  $('#go', el).onclick = () => {
    const u = new SpeechSynthesisUtterance($('#t', el).value), v = speechSynthesis.getVoices()[$('#v', el).value];
    if (v) u.voice = v;
    u.rate = +$('#r', el).value; speechSynthesis.cancel(); speechSynthesis.speak(u);
  };
  $('#st', el).onclick = () => speechSynthesis.cancel();
  return () => speechSynthesis.cancel();
} });

Tools.register({ id: 'stt', name: 'Speech to Text', icon: '🎙️', cat: 'audio', desc: 'Speak and see your words as text, then copy them.', needs: ['microphone'], render(el) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  el.innerHTML = `<textarea id="t" rows="8" placeholder="Your words appear here"></textarea>
    <div class="row"><button class="btn" id="go">Start listening</button><button class="btn alt" id="cp">Copy</button></div><div class="muted center" id="msg"></div>`;
  if (!SR) { $('#msg', el).textContent = 'Speech recognition is not available in this WebView.'; $('#go', el).disabled = true; }
  let rec = null;
  $('#go', el).onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) $('#t', el).value += e.results[i][0].transcript + ' '; };
    rec.onend = () => { rec = null; const g = $('#go', el); if (g) g.textContent = 'Start listening'; };
    rec.onerror = e => { const m = $('#msg', el); if (m) m.textContent = 'Error: ' + e.error; };
    rec.start(); $('#go', el).textContent = 'Stop';
  };
  $('#cp', el).onclick = () => navigator.clipboard.writeText($('#t', el).value).then(() => toast('Copied'), () => toast('Copy failed'));
  return () => { if (rec) rec.abort(); };
} });
