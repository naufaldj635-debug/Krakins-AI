# ClipAI — AI Video Editor (MVP)

Browser-based video editor bertenaga AI. Dibangun dengan HTML, CSS, JavaScript vanilla — tanpa framework berat.

---

## Cara Menjalankan

```bash
# Cukup buka index.html di browser modern (Chrome/Edge disarankan)
open index.html

# Atau jalankan server lokal sederhana:
python -m http.server 8080
# Buka: http://localhost:8080
```

---

## Fitur MVP

| Fitur | Status | Teknologi |
|---|---|---|
| Upload video | ✅ | File API |
| Preview & playback | ✅ | HTML5 Video |
| Trim video | ✅ | Video.currentTime |
| Tambah teks overlay | ✅ | CSS Absolute |
| Auto subtitle (simulasi) | ✅ | Web Speech API |
| Background removal | 🔄 Simulasi | CSS blend mode |
| Tambah musik/audio | ✅ | Web Audio API |
| Filter & efek | ✅ | CSS filter |
| Export video | ✅ | MediaRecorder + Canvas |
| Timeline editor | ✅ | JS + CSS |

---

## Struktur File

```
ai-video-editor/
├── index.html       ← Struktur UI utama
├── style.css        ← Styling CapCut-like dark theme
├── app.js           ← Logic: upload, trim, text, AI, export
└── README.md        ← Panduan ini
```

---

## Menghubungkan Backend AI

### Setup Backend (Python + Flask)

```bash
pip install flask flask-cors openai-whisper ffmpeg-python rembg
```

```python
# backend.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import ffmpeg
import tempfile, os

app = Flask(__name__)
CORS(app)
model = whisper.load_model("base")  # atau "small", "medium"

@app.route('/api/subtitle', methods=['POST'])
def generate_subtitle():
    video = request.files['video']
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as f:
        video.save(f.name)
        result = model.transcribe(f.name, language='id')
        os.unlink(f.name)
    
    subtitles = [
        {
            "id": i,
            "text": seg['text'].strip(),
            "start": round(seg['start'], 2),
            "end": round(seg['end'], 2)
        }
        for i, seg in enumerate(result['segments'])
    ]
    return jsonify({"subtitles": subtitles})

@app.route('/api/trim', methods=['POST'])
def trim_video():
    video = request.files['video']
    start = float(request.form.get('start', 0))
    end = float(request.form.get('end', 10))
    
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as inp:
        video.save(inp.name)
        out_path = inp.name.replace('.mp4', '_trimmed.mp4')
        (
            ffmpeg.input(inp.name, ss=start, to=end)
            .output(out_path, codec='copy')
            .run(overwrite_output=True)
        )
        with open(out_path, 'rb') as f:
            data = f.read()
        os.unlink(inp.name)
        os.unlink(out_path)
    
    return data, 200, {'Content-Type': 'video/mp4'}

@app.route('/api/bg-remove', methods=['POST'])
def remove_background():
    # Requires rembg for image, or mediapipe for video
    from rembg import remove
    from PIL import Image
    import io
    
    img_data = request.files['image'].read()
    result = remove(img_data)
    return result, 200, {'Content-Type': 'image/png'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### Integrasi di Frontend (app.js)

```javascript
// Ganti simulateSubtitles() dengan panggilan API nyata:
async function runAutoSubtitleAPI() {
    const file = state.videos[state.activeVideoIdx].file;
    const formData = new FormData();
    formData.append('video', file);
    
    const res = await fetch('http://localhost:5000/api/subtitle', {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    state.subtitles = data.subtitles;
    renderSubtitleList();
    renderSubtitleTimeline();
}
```

---

## Roadmap Pengembangan

### Phase 1 — MVP (Selesai)
- [x] Upload & preview video
- [x] Trim dengan drag handle
- [x] Teks overlay dengan posisi
- [x] Filter CSS
- [x] Tambah audio/musik
- [x] Auto subtitle (Web Speech / simulasi)
- [x] Export via MediaRecorder + Canvas

### Phase 2 — Enhanced (1-2 bulan)
- [ ] Backend Python + FFmpeg untuk trim/export berkualitas tinggi
- [ ] Whisper AI subtitle yang akurat
- [ ] Undo/Redo dengan state history
- [ ] Multiple video clips di timeline
- [ ] Transition antar klip
- [ ] Waveform audio nyata via Web Audio API

### Phase 3 — Advanced (3-6 bulan)
- [ ] Background removal real-time (MediaPipe / rembg)
- [ ] AI auto-cut (potong bagian diam/bising otomatis)
- [ ] Template preset (Reels, TikTok, YouTube)
- [ ] Cloud storage & project save
- [ ] Kolaborasi real-time
- [ ] Mobile-responsive editor
- [ ] Ekspor ke MP4 berkualitas tinggi via FFmpeg WASM

### Phase 4 — Production
- [ ] GPU-accelerated rendering
- [ ] AI scene detection & smart trim
- [ ] Voice cloning / dubbing
- [ ] Multi-language subtitle
- [ ] Monetization (freemium model)

---

## Optimasi Performa

1. **Web Workers** — jalankan proses berat di background thread
2. **FFmpeg WASM** — untuk encoding MP4 langsung di browser
3. **IndexedDB** — simpan video project secara lokal
4. **Canvas OffscreenCanvas** — rendering overlay lebih cepat
5. **Lazy load** — thumbnail media dimuat saat scroll

---

## Tips Penggunaan

- Gunakan **Chrome/Edge** untuk dukungan MediaRecorder terbaik
- Video pendek (< 5 menit) untuk performa optimal di MVP
- Auto Subtitle butuh HTTPS atau localhost untuk Web Speech API
- Export menghasilkan format WebM (putar di semua browser modern)
