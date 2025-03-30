# Equalizer Plus

**Equalizer Plus** is a Chrome extension that processes the audio of browser tabs in real time. It gives users full control over playback sound using an integrated equalizer, compressor, stereo/mono controls, volume boost, and panning—all from an accessible and minimal UI.

Originally built to fill a gap in the Chrome Web Store, Equalizer Plus now serves over 10,000 users. It is designed using plain JavaScript and the Web Audio API, with no external frameworks or build tools.

---

## 🎧 Features

- **10-Band Equalizer** (20Hz – 20kHz)
- **Dynamics Compressor** (threshold, ratio, knee, attack, release)
- **Volume Boost** (up to 400%)
- **Mono / Stereo Toggle**
- **Pan Control**
- **Phase Inversion**
- **Presets and Saved Settings**
- **Multi-tab audio control**

---

## 🛠 How It Works

Equalizer Plus uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to capture and manipulate audio from Chrome tabs. It processes the stream in an offscreen context and provides a visual control panel through the popup UI.

Key architecture components:
- **Service Worker** handles background logic and routing
- **Offscreen Document** manages the real-time audio processing pipeline
- **Popup UI** provides interactive controls (knobs, toggles, sliders)
- **chrome.storage.sync** persists user settings
- **Message passing** coordinates between UI, background, and offscreen threads

All logic is written in **vanilla JavaScript**, with basic use of jQuery and jQuery.knob for UI.

---

## 📦 Repository Structure

equalizer-plus/

├── assets/                # Fonts and images

│   ├── font/

│   └── images/

├── js/                    # JavaScript source

│   ├── libs/              # External libraries (jQuery, knob.js, nprogress)

│   ├── offscreen.js

│   ├── popup.js

│   └── serviceworker.js

├── style/                 # CSS styles
│   ├── nprogress.css
│   └── style.css

├── manifest.json          # Chrome extension manifest

├── popup.html             # Extension UI

└── package.json


---

## 🔗 Links

- [Live Extension on Chrome Web Store](https://chromewebstore.google.com/detail/equalizer-plus/hhknncjekdkcckekbooephopomcjeiek)
- [GitHub Repository](https://github.com/NikoSardas/equalizer-plus)

---

## 🧠 Author

Built by [Niko Sardas](https://github.com/NikoSardas)  
A solo project born out of curiosity, problem-solving, and the desire to build something useful without noise.

---

## 🪪 License

MIT – Free to use, modify, and distribute with attribution.
