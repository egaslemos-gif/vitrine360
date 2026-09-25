/** Static demo playlist — Landing only. Not persisted. */

export type DemoMediaType = "VIDEO" | "IMAGE";

export type DemoPlaylistItem = {
  id: string;
  title: string;
  type: DemoMediaType;
  /** Duration in seconds */
  duration: number;
  /** Local static visual asset */
  src: string;
  accent: string;
};

export const DEMO_PLAYLIST: DemoPlaylistItem[] = [
  {
    id: "demo-01",
    title: "Welcome to Vitrine360",
    type: "VIDEO",
    duration: 18,
    src: "/demo/media/welcome.svg",
    accent: "#6d4aff",
  },
  {
    id: "demo-02",
    title: "Digital Experiences",
    type: "IMAGE",
    duration: 8,
    src: "/demo/media/experiences.svg",
    accent: "#3b82f6",
  },
  {
    id: "demo-03",
    title: "Interactive Displays",
    type: "VIDEO",
    duration: 22,
    src: "/demo/media/interactive.svg",
    accent: "#8b5cf6",
  },
  {
    id: "demo-04",
    title: "Presentation Mode",
    type: "IMAGE",
    duration: 10,
    src: "/demo/media/presentation.svg",
    accent: "#ec4899",
  },
];

export type DemoPlaybackStatus = "PLAYING" | "PAUSED" | "STOPPED";

export type DemoPlayerState = {
  status: DemoPlaybackStatus;
  currentIndex: number;
  positionMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
};

export function formatDemoTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
