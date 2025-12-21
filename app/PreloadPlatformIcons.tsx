"use client";

import { useEffect } from "react";

export default function PreloadPlatformIcons() {
  useEffect(() => {
    async function preload() {
      try {
        const res = await fetch("/platforms/manifest.json");

        if (!res.ok) return;

        const icons: string[] = await res.json();

        icons.forEach((name) => {
          const img = new Image();
          img.src = `/platforms/${name}.svg`;
        });
      } catch (err) {
        console.error("Failed preloading platform icons:", err);
      }
    }

    preload();
  }, []);

  return null;
}
