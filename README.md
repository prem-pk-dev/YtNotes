# YT Study Notes Pro

A zero-backend Chrome Extension (Manifest V3) for timestamped YouTube study notes. Built with vanilla HTML, CSS, and JavaScript — no bundler or build step.

## Install in Chrome
1. Download this repository as a ZIP and extract it, or clone it with Git.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the extracted `YtNotes` repository folder (the folder containing `manifest.json`).
6. Open any YouTube video. The notes panel appears in the lower-right corner; the toolbar icon opens the dashboard.

## Test Pro mode
1. Open the extension popup or the panel's Upgrade dialog.
2. Enter `PRO-TEST-2026` and click **Activate**.
3. Pro features unlock locally for testing. This test key is not a real paid license.

Other Lemon Squeezy keys are checked using its public License Validation endpoint. No API secret is stored in the extension. Configure the Lemon Squeezy product and license policy before commercial distribution.

## Features
- Timestamped notes with seek-and-play, edit, and delete
- Clean video-frame screenshots (JPEG, max 640px, quality 0.65)
- Dark/light themes, minimized panel, and focus mode
- Auto-pause while composing notes
- Local per-video storage with `chrome.storage.local`
- Free limits: 5 notes and 2 screenshots per video
- Pro: unlimited notes/screenshots, print-to-PDF, and Markdown copy

## Privacy and limitations
Notes and screenshots stay in Chrome local extension storage on this device. There is no application backend, analytics, or remote note sync. License validation for non-test keys contacts Lemon Squeezy. Screenshot capture depends on the browser allowing the current video frame to be drawn to canvas; some playback configurations may block capture.

## Development
No build tools are required. Reload the extension from `chrome://extensions` after editing files. Content UI styles are isolated in Shadow DOM; `styles.css` is intentionally minimal because the panel ships its scoped styles in the shadow root.
