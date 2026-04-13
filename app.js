/* ============================================
   ClipAI — AI Video Editor
   app.js — Main Application Logic
   ============================================ */

'use strict';

// ============ STATE ============
const state = {
  videos: [],            // uploaded video files
  activeVideoIdx: 0,
  audioFiles: [],        // uploaded audio files
  textLayers: [],        // { id, text, font, size, color, position, start, end }
  subtitles: [],         // { id, text, start, end }
  trim: { start: 0, end: 0 },
  duration: 0,
  filter: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  audioVolume: 1.0,
  videoVolume: 1.0,
  isPlaying: false,
  zoom: 1,
  isMuted: false,
  textPosition: 'center',
  recorder: null,
  recordedChunks: [],
};

// ============ DOM REFS ============
const $ = id => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

const dom = {
  videoInput: $('videoInput'),
  audioInput: $('audioInput'),
  uploadZone: $('uploadZone'),
  audioUploadZone: $('audioUploadZone'),
  mediaGrid: $('mediaGrid'),
  emptyState: $('emptyState'),
  videoWrapper: $('videoWrapper'),
  mainVideo: $('mainVideo'),
  overlayCanvas: $('overlayCanvas'),
  textOverlays: $('textOverlays'),
  playbackControls: $('playbackControls'),
  timelineArea: $('timelineArea'),
  currentTime: $('currentTime'),
  totalTime: $('totalTime'),
  btnPlay: $('btnPlay'),
  playIcon: $('playIcon'),
  pauseIcon: $('pauseIcon'),
  btnSkipBack: $('btnSkipBack'),
  btnSkipFwd: $('btnSkipFwd'),
  btnMute: $('btnMute'),
  btnExport: $('btnExport'),
  btnExportRight: $('btnExportRight'),
  trimStart: $('trimStart'),
  trimEnd: $('trimEnd'),
  textLayerList: $('textLayerList'),
  subtitleList: $('subtitleList'),
  aiStatus: $('aiStatus'),
  playhead: $('playhead'),
  videoTrackBody: $('videoTrackBody'),
  audioTrackBody: $('audioTrackBody'),
  subtitleTrackBody: $('subtitleTrackBody'),
  mainClip: $('mainClip'),
  exportModal: $('exportModal'),
  exportProgressFill: $('exportProgressFill'),
  exportStatus: $('exportStatus'),
  exportActions: $('exportActions'),
  exportDownloadLink: $('exportDownloadLink'),
  audioTracks: $('audioTracks'),
  toastContainer: $('toastContainer'),
};

// ============ INIT ============
function init() {
  bindToolButtons();
  bindUploadZone();
  bindPlaybackControls();
  bindTextPanel();
  bindAudioPanel();
  bindAIPanel();
  bindEffectsPanel();
  bindTrimControls();
  bindExport();
  bindTimeline();
  bindTopbar();
}

// ============ TOOL NAV ============
function bindToolButtons() {
  $$('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const panel = btn.dataset.panel;
      $$('.panel-section').forEach(s => s.classList.remove('active'));
      $(`panel-${panel}`).classList.add('active');
    });
  });
}

// ============ VIDEO UPLOAD ============
function bindUploadZone() {
  // Click to upload
  dom.uploadZone.addEventListener('click', () => dom.videoInput.click());
  $('btnUploadEmpty').addEventListener('click', () => dom.videoInput.click());
  dom.videoInput.addEventListener('change', e => handleVideoFiles(e.target.files));

  // Drag and drop
  dom.uploadZone.addEventListener('dragover', e => { e.preventDefault(); dom.uploadZone.classList.add('dragover'); });
  dom.uploadZone.addEventListener('dragleave', () => dom.uploadZone.classList.remove('dragover'));
  dom.uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.uploadZone.classList.remove('dragover');
    handleVideoFiles(e.dataTransfer.files);
  });

  // Audio upload
  dom.audioUploadZone.addEventListener('click', () => dom.audioInput.click());
  dom.audioInput.addEventListener('change', e => handleAudioFile(e.target.files[0]));
}

function handleVideoFiles(files) {
  [...files].forEach(file => {
    if (!file.type.startsWith('video/')) { showToast('File harus berformat video', 'error'); return; }
    const url = URL.createObjectURL(file);
    state.videos.push({ file, url, name: file.name });
    addMediaThumbnail(state.videos.length - 1, url, file.name);
    if (state.videos.length === 1) loadVideoToPlayer(0);
  });
}

function addMediaThumbnail(idx, url, name) {
  const div = document.createElement('div');
  div.className = 'media-thumb';
  div.dataset.idx = idx;

  const vid = document.createElement('video');
  vid.src = url;
  vid.preload = 'metadata';
  vid.muted = true;

  const label = document.createElement('div');
  label.className = 'media-thumb-label';
  label.textContent = name;

  div.append(vid, label);
  div.addEventListener('click', () => loadVideoToPlayer(idx));
  dom.mediaGrid.appendChild(div);

  // Remove placeholder if exists
  const placeholder = dom.mediaGrid.querySelector('.upload-zone-placeholder');
  if (placeholder) placeholder.remove();
}

function loadVideoToPlayer(idx) {
  state.activeVideoIdx = idx;
  $$('.media-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));

  const { url } = state.videos[idx];
  dom.mainVideo.src = url;
  dom.mainVideo.load();

  dom.emptyState.style.display = 'none';
  dom.videoWrapper.style.display = 'block';
  dom.playbackControls.style.display = 'flex';
  dom.timelineArea.style.display = 'flex';

  dom.mainVideo.addEventListener('loadedmetadata', () => {
    state.duration = dom.mainVideo.duration;
    state.trim = { start: 0, end: state.duration };
    dom.trimStart.value = 0;
    dom.trimEnd.value = parseFloat(state.duration.toFixed(2));
    dom.totalTime.textContent = formatTime(state.duration);
    renderTimeline();
    generateWaveform();
    showToast(`Video dimuat: ${state.videos[idx].name.substring(0, 30)}`, 'success');
  }, { once: true });

  dom.mainVideo.addEventListener('timeupdate', onTimeUpdate);
  dom.mainVideo.addEventListener('ended', onVideoEnded);

  syncVideoVolume();
  applyFilter();
}

// ============ AUDIO UPLOAD ============
function handleAudioFile(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/')) { showToast('File harus berformat audio', 'error'); return; }

  const url = URL.createObjectURL(file);
  const audio = new Audio(url);
  audio.volume = state.audioVolume;
  state.audioFiles.push({ file, url, name: file.name, audio });

  // Sync audio to video
  dom.mainVideo.addEventListener('play', () => { audio.currentTime = dom.mainVideo.currentTime; audio.play(); });
  dom.mainVideo.addEventListener('pause', () => audio.pause());
  dom.mainVideo.addEventListener('seeked', () => { audio.currentTime = dom.mainVideo.currentTime; });

  renderAudioTrackList();
  renderAudioTimeline();
  showToast(`Audio ditambahkan: ${file.name.substring(0, 30)}`, 'success');
}

function renderAudioTrackList() {
  dom.audioTracks.innerHTML = '';
  if (state.audioFiles.length === 0) {
    dom.audioTracks.innerHTML = '<div class="track-placeholder">Belum ada audio</div>';
    return;
  }
  state.audioFiles.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'audio-track-item';
    item.innerHTML = `
      <span class="audio-track-icon">♫</span>
      <span class="audio-track-name">${a.name}</span>
      <button class="audio-track-del" data-idx="${i}" title="Hapus">×</button>
    `;
    item.querySelector('.audio-track-del').addEventListener('click', () => removeAudio(i));
    dom.audioTracks.appendChild(item);
  });
}

function removeAudio(idx) {
  state.audioFiles[idx].audio.pause();
  URL.revokeObjectURL(state.audioFiles[idx].url);
  state.audioFiles.splice(idx, 1);
  renderAudioTrackList();
  renderAudioTimeline();
  showToast('Audio dihapus', 'info');
}

// ============ PLAYBACK CONTROLS ============
function bindPlaybackControls() {
  dom.btnPlay.addEventListener('click', togglePlay);
  dom.btnSkipBack.addEventListener('click', () => seek(dom.mainVideo.currentTime - 5));
  dom.btnSkipFwd.addEventListener('click', () => seek(dom.mainVideo.currentTime + 5));
  dom.btnMute.addEventListener('click', toggleMute);
  $('btnFullscreen').addEventListener('click', toggleFullscreen);
}

function togglePlay() {
  if (!dom.mainVideo.src) return;
  if (dom.mainVideo.paused) {
    // Respect trim boundaries
    if (dom.mainVideo.currentTime >= state.trim.end) {
      dom.mainVideo.currentTime = state.trim.start;
    }
    dom.mainVideo.play();
    state.isPlaying = true;
    dom.playIcon.style.display = 'none';
    dom.pauseIcon.style.display = 'block';
  } else {
    dom.mainVideo.pause();
    state.isPlaying = false;
    dom.playIcon.style.display = 'block';
    dom.pauseIcon.style.display = 'none';
  }
}

function seek(time) {
  time = Math.max(state.trim.start, Math.min(state.trim.end, time));
  dom.mainVideo.currentTime = time;
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  dom.mainVideo.muted = state.isMuted;
  state.audioFiles.forEach(a => a.audio.muted = state.isMuted);
  dom.btnMute.textContent = state.isMuted ? '🔇' : '🔊';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    dom.videoWrapper.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function onTimeUpdate() {
  const t = dom.mainVideo.currentTime;
  dom.currentTime.textContent = formatTime(t);

  // Trim end enforcement
  if (t >= state.trim.end) {
    dom.mainVideo.pause();
    state.isPlaying = false;
    dom.playIcon.style.display = 'block';
    dom.pauseIcon.style.display = 'none';
  }

  updatePlayhead(t);
  renderTextOverlays(t);
  renderSubtitleOverlay(t);
}

function onVideoEnded() {
  state.isPlaying = false;
  dom.playIcon.style.display = 'block';
  dom.pauseIcon.style.display = 'none';
}

// ============ TEXT OVERLAY ============
function bindTextPanel() {
  $('btnAddText').addEventListener('click', addTextLayer);
  $$('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.textPosition = btn.dataset.pos;
    });
  });
}

function addTextLayer() {
  const text = $('textContent').value.trim();
  if (!text) { showToast('Masukkan teks terlebih dahulu', 'error'); return; }

  const layer = {
    id: Date.now(),
    text,
    font: $('textFont').value,
    size: parseInt($('textSize').value),
    color: $('textColor').value,
    position: state.textPosition,
    start: parseFloat($('textStart').value) || 0,
    end: parseFloat($('textEnd').value) || 5,
  };

  state.textLayers.push(layer);
  renderTextLayerList();
  showToast('Teks ditambahkan', 'success');
  $('textContent').value = '';
}

function getPositionStyle(pos) {
  const map = {
    'top-left':    { left: '10%', top: '10%' },
    'top-center':  { left: '50%', top: '10%' },
    'top-right':   { left: '90%', top: '10%' },
    'mid-left':    { left: '10%', top: '50%' },
    'center':      { left: '50%', top: '50%' },
    'mid-right':   { left: '90%', top: '50%' },
    'bot-left':    { left: '10%', top: '85%' },
    'bot-center':  { left: '50%', top: '85%' },
    'bot-right':   { left: '90%', top: '85%' },
  };
  return map[pos] || map['center'];
}

function renderTextOverlays(currentTime) {
  dom.textOverlays.innerHTML = '';
  state.textLayers.forEach(layer => {
    if (currentTime >= layer.start && currentTime <= layer.end) {
      const el = document.createElement('div');
      el.className = 'text-overlay-item';
      el.textContent = layer.text;
      const pos = getPositionStyle(layer.position);
      el.style.cssText = `
        left: ${pos.left};
        top: ${pos.top};
        font-family: ${layer.font};
        font-size: ${layer.size}px;
        color: ${layer.color};
      `;
      dom.textOverlays.appendChild(el);
    }
  });
}

function renderSubtitleOverlay(currentTime) {
  const sub = state.subtitles.find(s => currentTime >= s.start && currentTime <= s.end);
  let subEl = document.getElementById('currentSubtitle');
  if (!subEl) {
    subEl = document.createElement('div');
    subEl.id = 'currentSubtitle';
    subEl.style.cssText = `
      position: absolute;
      bottom: 8%;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: 20px;
      font-weight: 600;
      text-align: center;
      text-shadow: 2px 2px 6px rgba(0,0,0,0.9);
      max-width: 90%;
      background: rgba(0,0,0,0.45);
      border-radius: 6px;
      padding: 4px 12px;
      pointer-events: none;
    `;
    dom.textOverlays.appendChild(subEl);
  }
  subEl.textContent = sub ? sub.text : '';
  subEl.style.display = sub ? 'block' : 'none';
}

function renderTextLayerList() {
  if (state.textLayers.length === 0) {
    dom.textLayerList.innerHTML = '<div class="empty-list">Belum ada teks</div>';
    return;
  }
  dom.textLayerList.innerHTML = '';
  state.textLayers.forEach(layer => {
    const item = document.createElement('div');
    item.className = 'text-layer-item';
    item.innerHTML = `
      <div class="text-layer-info">
        <div class="text-layer-content">${layer.text}</div>
        <div class="text-layer-time">${formatTime(layer.start)} – ${formatTime(layer.end)}</div>
      </div>
      <button class="text-layer-del" title="Hapus">×</button>
    `;
    item.querySelector('.text-layer-del').addEventListener('click', () => {
      state.textLayers = state.textLayers.filter(l => l.id !== layer.id);
      renderTextLayerList();
      showToast('Teks dihapus', 'info');
    });
    dom.textLayerList.appendChild(item);
  });
}

// ============ TRIM CONTROLS ============
function bindTrimControls() {
  $('btnApplyTrim').addEventListener('click', applyTrim);
  $('btnResetTrim').addEventListener('click', resetTrim);
}

function applyTrim() {
  const s = parseFloat(dom.trimStart.value);
  const e = parseFloat(dom.trimEnd.value);
  if (isNaN(s) || isNaN(e) || s >= e) {
    showToast('Nilai trim tidak valid', 'error');
    return;
  }
  state.trim.start = Math.max(0, s);
  state.trim.end = Math.min(state.duration, e);
  dom.mainVideo.currentTime = state.trim.start;
  renderTimeline();
  showToast(`Trim: ${formatTime(state.trim.start)} – ${formatTime(state.trim.end)}`, 'success');
}

function resetTrim() {
  state.trim = { start: 0, end: state.duration };
  dom.trimStart.value = 0;
  dom.trimEnd.value = parseFloat(state.duration.toFixed(2));
  dom.mainVideo.currentTime = 0;
  renderTimeline();
  showToast('Trim direset', 'info');
}

// ============ AUDIO PANEL ============
function bindAudioPanel() {
  $('audioVolume').addEventListener('input', e => {
    state.audioVolume = e.target.value / 100;
    $('audioVolLabel').textContent = `${e.target.value}%`;
    state.audioFiles.forEach(a => a.audio.volume = state.audioVolume);
  });
  $('videoVolume').addEventListener('input', e => {
    state.videoVolume = e.target.value / 100;
    $('videoVolLabel').textContent = `${e.target.value}%`;
    syncVideoVolume();
  });
}

function syncVideoVolume() {
  dom.mainVideo.volume = state.videoVolume;
}

// ============ EFFECTS PANEL ============
function bindEffectsPanel() {
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      applyFilter();
    });
  });

  ['brightness', 'contrast', 'saturation'].forEach(prop => {
    $(prop).addEventListener('input', e => {
      state[prop] = parseInt(e.target.value);
      $(`${prop}Label`).textContent = `${e.target.value}%`;
      applyFilter();
    });
  });
}

function applyFilter() {
  const { brightness, contrast, saturation, filter } = state;
  let f = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  if (filter !== 'none') f += ` ${filter}`;
  dom.mainVideo.style.filter = f;
}

// ============ AI PANEL ============
function bindAIPanel() {
  $('btnAutoSubtitle').addEventListener('click', runAutoSubtitle);
  $('btnBgRemoval').addEventListener('click', runBgRemoval);
  $('btnAutoCaption').addEventListener('click', runAutoCaption);
}

function showAIStatus(msg) {
  dom.aiStatus.style.display = 'block';
  dom.aiStatus.innerHTML = msg;
}

function hideAIStatus() {
  dom.aiStatus.style.display = 'none';
}

// Auto Subtitle — uses Web Speech API (simulation if not available)
async function runAutoSubtitle() {
  if (!dom.mainVideo.src) { showToast('Upload video terlebih dahulu', 'error'); return; }

  showAIStatus('◎ Menganalisis audio video...<br><small>Fitur ini membutuhkan koneksi dan mikrofon aktif di browser.</small>');

  // Check if SpeechRecognition is available
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    simulateSubtitles();
    return;
  }

  // Use Web Speech API for live recognition
  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'id-ID';

  let subIdx = 0;
  let startTime = 0;

  recognition.onstart = () => {
    showAIStatus('◎ Merekam... Putar video dan bicara ke mikrofon.<br><small>Subtitle akan dibuat dari ucapan yang terdeteksi.</small>');
    dom.mainVideo.play();
    startTime = dom.mainVideo.currentTime;
  };

  recognition.onresult = e => {
    const t = dom.mainVideo.currentTime;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        const text = e.results[i][0].transcript.trim();
        if (text) {
          const sub = { id: Date.now() + subIdx++, text, start: startTime, end: t };
          state.subtitles.push(sub);
          startTime = t;
          renderSubtitleList();
          renderSubtitleTimeline();
        }
      }
    }
  };

  recognition.onerror = () => simulateSubtitles();

  recognition.start();

  setTimeout(() => {
    recognition.stop();
    dom.mainVideo.pause();
    showAIStatus(`✦ Selesai! ${state.subtitles.length} subtitle dibuat.`);
    showToast('Auto subtitle selesai!', 'success');
    setTimeout(hideAIStatus, 3000);
  }, 15000);
}

function simulateSubtitles() {
  // Simulate subtitle generation for demo
  showAIStatus('◎ Generating subtitle (mode simulasi)...');
  const dur = state.duration || 30;
  const sampleSubs = [
    "Selamat datang di ClipAI Video Editor",
    "Aplikasi edit video bertenaga AI",
    "Upload dan edit video dengan mudah",
    "Tambahkan teks, filter, dan efek",
    "Export video hasil edit Anda",
  ];

  const segLen = dur / sampleSubs.length;
  state.subtitles = sampleSubs.map((text, i) => ({
    id: Date.now() + i,
    text,
    start: parseFloat((i * segLen).toFixed(2)),
    end: parseFloat(((i + 1) * segLen - 0.3).toFixed(2)),
  }));

  renderSubtitleList();
  renderSubtitleTimeline();
  showAIStatus(`✦ ${state.subtitles.length} subtitle dibuat (simulasi).<br><small>Hubungkan backend Whisper untuk hasil nyata.</small>`);
  showToast('Subtitle (simulasi) dibuat!', 'success');
  setTimeout(hideAIStatus, 4000);
}

function runBgRemoval() {
  if (!dom.mainVideo.src) { showToast('Upload video terlebih dahulu', 'error'); return; }
  showAIStatus('✦ Background removal aktif (simulasi).<br><small>Untuk produksi, hubungkan ke backend dengan rembg / MediaPipe.</small>');

  // Simulate visual effect
  dom.mainVideo.style.mixBlendMode = 'multiply';
  dom.previewContainer = $('previewContainer');

  showToast('Background removal (simulasi) diaktifkan', 'info');
  $('btnBgRemoval').textContent = 'Reset';
  $('btnBgRemoval').onclick = () => {
    dom.mainVideo.style.mixBlendMode = 'normal';
    $('btnBgRemoval').textContent = 'Mulai';
    $('btnBgRemoval').onclick = runBgRemoval;
    hideAIStatus();
    showToast('Background normal', 'info');
  };
}

function runAutoCaption() {
  if (!dom.mainVideo.src) { showToast('Upload video terlebih dahulu', 'error'); return; }
  showAIStatus('◈ Membuat caption dari konten video...');

  setTimeout(() => {
    const captions = [
      { text: "🎬 Buka dengan strong visual", start: 0, end: 3 },
      { text: "💡 Sampaikan pesan utama", start: 3, end: 7 },
      { text: "🎯 Call to action yang kuat", start: 7, end: state.duration - 1 },
    ];
    captions.forEach((c, i) => {
      state.textLayers.push({
        id: Date.now() + i,
        text: c.text,
        font: 'Arial',
        size: 28,
        color: '#ffffff',
        position: 'bot-center',
        start: c.start,
        end: c.end,
      });
    });
    renderTextLayerList();
    showAIStatus(`◈ ${captions.length} caption ditambahkan ke video.`);
    showToast('Auto caption selesai!', 'success');
    setTimeout(hideAIStatus, 3000);
  }, 2000);
}

function renderSubtitleList() {
  if (state.subtitles.length === 0) {
    dom.subtitleList.innerHTML = '<div class="empty-list">Belum ada subtitle</div>';
    return;
  }
  dom.subtitleList.innerHTML = '';
  state.subtitles.forEach(sub => {
    const item = document.createElement('div');
    item.className = 'subtitle-item';
    item.innerHTML = `
      <div class="subtitle-time">${formatTime(sub.start)} – ${formatTime(sub.end)}</div>
      <div class="subtitle-text">${sub.text}</div>
    `;
    dom.subtitleList.appendChild(item);
  });
}

// ============ TIMELINE ============
function bindTimeline() {
  // Clickable timeline for seeking
  dom.videoTrackBody.addEventListener('click', e => {
    if (!state.duration) return;
    const rect = dom.videoTrackBody.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * state.duration;
    dom.mainVideo.currentTime = Math.max(state.trim.start, Math.min(state.trim.end, time));
  });

  // Zoom
  $('btnZoomIn').addEventListener('click', () => {
    state.zoom = Math.min(state.zoom + 0.5, 4);
    $('zoomLevel').textContent = `${state.zoom}x`;
    renderTimeline();
  });
  $('btnZoomOut').addEventListener('click', () => {
    state.zoom = Math.max(state.zoom - 0.5, 0.5);
    $('zoomLevel').textContent = `${state.zoom}x`;
    renderTimeline();
  });

  // Trim handles drag
  bindTrimHandles();
}

function bindTrimHandles() {
  let dragging = null;

  const handleMouseMove = e => {
    if (!dragging) return;
    const rect = dom.videoTrackBody.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * state.duration;

    if (dragging === 'left') {
      state.trim.start = Math.max(0, Math.min(state.trim.end - 0.5, time));
      dom.trimStart.value = state.trim.start.toFixed(2);
    } else {
      state.trim.end = Math.min(state.duration, Math.max(state.trim.start + 0.5, time));
      dom.trimEnd.value = state.trim.end.toFixed(2);
    }
    renderTrimClip();
  };

  $('trimHandleLeft').addEventListener('mousedown', () => { dragging = 'left'; });
  $('trimHandleRight').addEventListener('mousedown', () => { dragging = 'right'; });
  document.addEventListener('mouseup', () => { dragging = null; });
  document.addEventListener('mousemove', handleMouseMove);
}

function renderTimeline() {
  if (!state.duration) return;
  renderTrimClip();
}

function renderTrimClip() {
  const leftPct = (state.trim.start / state.duration) * 100;
  const widthPct = ((state.trim.end - state.trim.start) / state.duration) * 100;
  dom.mainClip.style.left = `${leftPct}%`;
  dom.mainClip.style.width = `${widthPct}%`;
  dom.mainClip.style.right = 'auto';
}

function updatePlayhead(time) {
  if (!state.duration) return;
  const pct = (time / state.duration) * 100;
  dom.playhead.style.left = `${pct}%`;
}

function generateWaveform() {
  const waveform = $('clipWaveform');
  waveform.innerHTML = '';
  const barCount = 40;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    const h = Math.random() * 14 + 2;
    bar.style.height = `${h}px`;
    waveform.appendChild(bar);
  }
}

function renderAudioTimeline() {
  dom.audioTrackBody.innerHTML = '';
  if (state.audioFiles.length === 0) {
    dom.audioTrackBody.innerHTML = '<div class="empty-track">Belum ada audio</div>';
    return;
  }
  const clip = document.createElement('div');
  clip.className = 'track-clip';
  clip.style.left = '0';
  clip.style.width = '80%';
  clip.innerHTML = `
    <div class="clip-body" style="background: rgba(6,214,160,0.2); border-color: rgba(6,214,160,0.5);">
      <span class="clip-label" style="color: #06D6A0;">♫ ${state.audioFiles[state.audioFiles.length - 1].name.substring(0, 20)}</span>
      <div class="clip-waveform" id="audioWaveform"></div>
    </div>
  `;
  dom.audioTrackBody.appendChild(clip);

  // Generate audio waveform
  const waveform = clip.querySelector('#audioWaveform');
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.background = '#06D6A0';
    bar.style.height = `${Math.random() * 14 + 2}px`;
    waveform.appendChild(bar);
  }
}

function renderSubtitleTimeline() {
  dom.subtitleTrackBody.innerHTML = '';
  if (!state.duration || state.subtitles.length === 0) return;

  state.subtitles.forEach(sub => {
    const leftPct = (sub.start / state.duration) * 100;
    const widthPct = ((sub.end - sub.start) / state.duration) * 100;
    const block = document.createElement('div');
    block.className = 'subtitle-block';
    block.style.left = `${leftPct}%`;
    block.style.width = `${Math.max(widthPct, 2)}%`;
    block.textContent = sub.text;
    block.title = sub.text;
    dom.subtitleTrackBody.appendChild(block);
  });
}

// ============ EXPORT ============
function bindExport() {
  const doExport = () => showExportModal();
  dom.btnExport.addEventListener('click', doExport);
  dom.btnExportRight.addEventListener('click', doExport);
  $('btnCloseExport').addEventListener('click', () => dom.exportModal.style.display = 'none');
  $('btnCancelExport').addEventListener('click', cancelExport);
}

function showExportModal() {
  if (!dom.mainVideo.src) { showToast('Tidak ada video untuk di-export', 'error'); return; }
  dom.exportModal.style.display = 'flex';
  dom.exportProgressFill.style.width = '0';
  dom.exportStatus.textContent = 'Mempersiapkan export...';
  dom.exportActions.style.display = 'none';
  $('btnCancelExport').style.display = 'inline-block';
  startExport();
}

let exportAborted = false;

function cancelExport() {
  exportAborted = true;
  if (state.recorder) { state.recorder.stop(); state.recorder = null; }
  dom.exportModal.style.display = 'none';
  showToast('Export dibatalkan', 'info');
}

async function startExport() {
  exportAborted = false;
  const quality = $('exportQuality').value;
  const bitrate = quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 1500000;

  try {
    // Capture video with canvas for overlay composition
    dom.exportStatus.textContent = 'Menyiapkan canvas...';
    updateExportProgress(10);

    const canvas = document.createElement('canvas');
    const video = dom.mainVideo;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // Stream from canvas
    const canvasStream = canvas.captureStream(30);

    // Add audio if original video has audio
    let stream = canvasStream;
    try {
      const vidStream = video.captureStream?.();
      if (vidStream) {
        const audioTracks = vidStream.getAudioTracks();
        audioTracks.forEach(t => canvasStream.addTrack(t));
      }
    } catch(e) { /* ignore */ }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    state.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
    state.recordedChunks = [];

    state.recorder.ondataavailable = e => { if (e.data.size > 0) state.recordedChunks.push(e.data); };
    state.recorder.onstop = finishExport;

    // Render loop
    video.currentTime = state.trim.start;
    await new Promise(r => video.addEventListener('seeked', r, { once: true }));
    video.play();
    state.recorder.start(100);

    dom.exportStatus.textContent = 'Merekam video...';

    const renderFrame = () => {
      if (exportAborted) return;
      const t = video.currentTime;
      if (t >= state.trim.end || video.ended) {
        video.pause();
        state.recorder.stop();
        return;
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw text overlays
      state.textLayers.forEach(layer => {
        if (t >= layer.start && t <= layer.end) {
          ctx.font = `bold ${layer.size}px ${layer.font}`;
          ctx.fillStyle = layer.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = Math.max(2, layer.size / 20);
          ctx.textAlign = 'center';

          const pos = getPositionStyle(layer.position);
          const x = (parseFloat(pos.left) / 100) * canvas.width;
          const y = (parseFloat(pos.top) / 100) * canvas.height;

          ctx.strokeText(layer.text, x, y);
          ctx.fillText(layer.text, x, y);
        }
      });

      // Draw subtitles
      const sub = state.subtitles.find(s => t >= s.start && t <= s.end);
      if (sub) {
        ctx.font = `bold 36px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width * 0.05, canvas.height * 0.82, canvas.width * 0.9, 50);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(sub.text, canvas.width / 2, canvas.height * 0.86);
        ctx.fillText(sub.text, canvas.width / 2, canvas.height * 0.86);
      }

      // Progress
      const pct = 10 + ((t - state.trim.start) / (state.trim.end - state.trim.start)) * 85;
      updateExportProgress(Math.min(95, pct));
      dom.exportStatus.textContent = `Merekam: ${formatTime(t - state.trim.start)} / ${formatTime(state.trim.end - state.trim.start)}`;

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);

  } catch (err) {
    dom.exportStatus.textContent = `Error: ${err.message}`;
    showToast('Export gagal: ' + err.message, 'error');
    console.error(err);
  }
}

function finishExport() {
  updateExportProgress(100);
  dom.exportStatus.textContent = 'Export selesai!';
  $('btnCancelExport').style.display = 'none';

  const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  dom.exportDownloadLink.href = url;
  dom.exportDownloadLink.download = `ClipAI_${Date.now()}.webm`;
  dom.exportActions.style.display = 'flex';

  const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
  dom.exportStatus.textContent = `Ukuran: ${sizeMB} MB — Siap didownload!`;
  showToast('Export berhasil!', 'success');
}

function updateExportProgress(pct) {
  dom.exportProgressFill.style.width = `${Math.round(pct)}%`;
}

// ============ TOP BAR ============
function bindTopbar() {
  $('btnUndo').addEventListener('click', () => showToast('Undo belum tersedia di MVP', 'info'));
  $('btnRedo').addEventListener('click', () => showToast('Redo belum tersedia di MVP', 'info'));
}

// ============ HELPERS ============
function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.2s ease reverse';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

// ============ START ============
document.addEventListener('DOMContentLoaded', init);
