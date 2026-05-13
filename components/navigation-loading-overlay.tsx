"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PageTurnLoader from "@/components/page-turn-loader";

const isInternalNavigationLink = (anchor: HTMLAnchorElement) => {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${url.pathname}${url.search}${url.hash}`;
  return current !== next;
};

export default function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);

  const show = () => {
    setVisible(true);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setVisible(false), 3500);
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (isInternalNavigationLink(anchor)) show();
    };

    const handleNavigationStart = () => show();

    document.addEventListener("click", handleClick, true);
    window.addEventListener("textnext:navigation-start", handleNavigationStart);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("textnext:navigation-start", handleNavigationStart);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    if (!visible) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 180);
  }, [pathname, visible]);

  return visible ? <PageTurnLoader overlay /> : null;
}
