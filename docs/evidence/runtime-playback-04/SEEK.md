# SEEK

Custom track/progress/thumb. Pointer click+drag; keyboard on focused slider.

**Preview strategy:** local `previewMs` during drag; single `SEEK` on pointer up (avoids hundreds of dispatches). Invalid/NaN rejected; Controller clamps.
