"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform),
    () => false
  );
}

export type ShortcutBinding = {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutOptions = {
  enabled?: boolean;
  allowInEditable?: boolean;
  preventDefault?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function matches(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (event.key.toLowerCase() !== binding.key.toLowerCase()) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (Boolean(binding.mod) !== mod) return false;
  if (Boolean(binding.shift) !== event.shiftKey) return false;
  if (Boolean(binding.alt) !== event.altKey) return false;
  return true;
}

export function useKeyboardShortcut(
  binding: ShortcutBinding,
  handler: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const { enabled = true, allowInEditable = false, preventDefault = true } = options;
  const { key, mod, shift, alt } = binding;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!matches(event, { key, mod, shift, alt })) return;
      if (!allowInEditable && isEditableTarget(event.target)) return;
      if (preventDefault) event.preventDefault();
      handlerRef.current(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, allowInEditable, preventDefault, key, mod, shift, alt]);
}
