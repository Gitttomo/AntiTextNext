"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const TAB_ROUTES = ["/", "/notifications", "/listing", "/profile", "/transactions"];

const isInteractiveElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("input, textarea, select, [data-no-swipe]");
};

const getCurrentTabIndex = (pathname: string | null) => {
  if (!pathname) return -1;
  return TAB_ROUTES.findIndex((route) => pathname === route);
};

export default function SwipeTabNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const currentIndex = getCurrentTabIndex(pathname);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (currentIndex < 0 || isInteractiveElement(event.target)) {
        startRef.current = null;
        return;
      }

      const touch = event.touches[0];
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: event.target,
      };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || currentIndex < 0 || isInteractiveElement(start.target)) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const isHorizontalSwipe = Math.abs(deltaX) > 90 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

      if (!isHorizontalSwipe) return;

      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextRoute = TAB_ROUTES[nextIndex];
      if (nextRoute) {
        suppressClickUntilRef.current = Date.now() + 500;
        window.dispatchEvent(new Event("textnext:navigation-start"));
        router.push(nextRoute);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (Date.now() > suppressClickUntilRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("click", handleClick, true);
    };
  }, [currentIndex, router]);

  return null;
}
