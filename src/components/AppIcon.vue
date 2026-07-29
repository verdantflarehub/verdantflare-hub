<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
  stroke: { type: Number, default: 1.8 },
});

const paths = {
  overview: ["M3 3h7v7H3z", "M14 3h7v4h-7z", "M14 11h7v10h-7z", "M3 14h7v7H3z"],
  market: ["M4 7h16l-1 14H5z", "M8 10V6a4 4 0 0 1 8 0v4"],
  experience: ["M8 3h8", "M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8a3 3 0 0 0 2.6-4l-5-9V3", "M8 15h8"],
  models: ["M4 6h16v12H4z", "M8 10h.01", "M16 10h.01", "M9 15h6", "M12 2v4"],
  key: ["M15 7a5 5 0 1 0-3.7 8.4L14 18h3v3h3v-3l-4.4-4.4", "M7.5 10.5h.01"],
  playground: ["M5 3h14v18H5z", "M8 8h8", "M8 12h5", "M8 16h3"],
  tasks: ["M9 5h10", "M9 12h10", "M9 19h10", "M4 5h.01", "M4 12h.01", "M4 19h.01"],
  usage: ["M4 19V9", "M10 19V5", "M16 19v-7", "M22 19H2"],
  organization: ["M3 21h18", "M6 21V8l6-5 6 5v13", "M9 12h.01", "M15 12h.01", "M9 16h.01", "M15 16h.01"],
  members: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  billing: ["M3 6h18v12H3z", "M3 10h18", "M7 15h3"],
  release: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  clients: ["M4 20h16", "M6 20V9h12v11", "M9 13h.01", "M15 13h.01", "M9 17h.01", "M15 17h.01", "M9 9V5h6v4"],
  search: ["M21 21l-4.35-4.35", "M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  chevron: ["m9 18 6-6-6-6"],
  plus: ["M12 5v14", "M5 12h14"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  spark: ["m12 3-1.6 4.4L6 9l4.4 1.6L12 15l1.6-4.4L18 9l-4.4-1.6z", "m19 15-.8 2.2L16 18l2.2.8L19 21l.8-2.2L22 18l-2.2-.8z"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  copy: ["M8 8h11v11H8z", "M5 16H4V4h12v1"],
  check: ["m5 12 4 4L19 6"],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M14 3h7v18h-7"],
  nodes: ["M6 6h4v4H6z", "M14 14h4v4h-4z", "M10 8h3a3 3 0 0 1 3 3v3"],
  video: ["M3 6h13v12H3z", "m16 10 5-3v10l-5-3"],
  wave: ["M3 12h2l2-6 4 12 3-9 3 6 2-3h2"],
  cut: ["M4 4l16 16", "M4 20 20 4", "M7 7a3 3 0 1 1-4 0 3 3 0 0 1 4 0", "M7 17a3 3 0 1 1-4 0 3 3 0 0 1 4 0"],
  chat: ["M4 5h16v12H8l-4 4z", "M8 9h8", "M8 13h5"],
  face: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M8.5 10h.01", "M15.5 10h.01", "M8 15c2 2 6 2 8 0"],
  external: ["M14 3h7v7", "M10 14 21 3", "M21 14v7H3V3h7"],
  warning: ["M12 3 2 21h20z", "M12 9v4", "M12 17h.01"],
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in paths[name] || paths.overview" :key="path" :d="path" />
  </svg>
</template>
