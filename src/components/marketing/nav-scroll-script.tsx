"use client";

import { useEffect } from "react";

export function NavScrollScript() {
  useEffect(() => {
    const nav = document.querySelector("nav");
    if (!nav) return;

    function onScroll() {
      nav!.classList.toggle("scrolled", window.scrollY > 10);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
