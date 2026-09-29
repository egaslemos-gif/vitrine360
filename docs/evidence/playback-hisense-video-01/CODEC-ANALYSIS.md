# CODEC ANALYSIS

## 1. Hisense Sraf Browser Codec Support
The Sraf HTML5 browser found on older Hisense Smart TVs is typically based on Chromium/Blink but with a custom media backend.
Support for modern formats like HEVC (H.265) or VP9/AV1 is highly hardware-dependent and often fails inside the Web engine context even if the native TV apps support them.

## 2. Recommendation
For maximum compatibility with Vitrine360 players running on Hisense TVs:
- **Container**: MP4 (`.mp4`)
- **Video Codec**: H.264 (AVC)
- **Profile**: Main or High Profile (Level 4.1 or lower)
- **Resolution**: 1080p (1920x1080) maximum; 720p is safer for low-end models.
- **Audio Codec**: AAC (Advanced Audio Coding)

Any video encoded in WebM, AV1, or HEVC may fail to decode and trigger `MEDIA_DECODE_ERROR`, advancing the playlist prematurely.
