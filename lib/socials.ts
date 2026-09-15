export type Social = {
  name: string;
  /** Shown under the name on the dashboard; keep it short enough for one line. */
  description: string;
  url: string;
  /** Brand colour, used for the accent dot on the dashboard and the link text in email. */
  color: string;
};

/** One source of truth for the dashboard card and the certificate email. */
export const SOCIALS: Social[] = [
  {
    name: "Discord",
    description: "DevTrackAcademy Server · GNI Workshop channel",
    url: "https://discord.gg/ZcS5KMYsx",
    color: "#5865F2",
  },
  {
    name: "Instagram",
    description: "@devtrackacademy",
    url: "https://www.instagram.com/devtrackacademy",
    color: "#E1306C",
  },
  {
    name: "X",
    description: "@DevTrackAcademy",
    url: "https://x.com/DevTrackAcademy",
    color: "#1B1F3B",
  },
  {
    name: "Reddit",
    description: "r/devtrackacademy",
    url: "https://www.reddit.com/r/devtrackacademy/",
    color: "#FF4500",
  },
];
