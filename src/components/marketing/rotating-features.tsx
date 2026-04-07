"use client";

import { useEffect, useState } from "react";

const features = [
  "Auto-replies that sound like you",
  "AI drafts enriched with customer data",
  "Trained on your knowledge base",
  "Up and running in minutes",
];

export function RotatingFeatures() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % features.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex items-center justify-center gap-2 sm:hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="text-primary">✦</span>
      <span className="font-body text-sm text-text-secondary">
        {features[index]}
      </span>
    </div>
  );
}
