"use client";

import { useEffect } from "react";

export default function MobileGestureGuard() {
  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const preventCtrlWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    document.addEventListener("gesturestart", preventDefault, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gesturechange", preventDefault, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gestureend", preventDefault, { passive: false } as AddEventListenerOptions);
    window.addEventListener("wheel", preventCtrlWheel, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("gesturestart", preventDefault);
      document.removeEventListener("gesturechange", preventDefault);
      document.removeEventListener("gestureend", preventDefault);
      window.removeEventListener("wheel", preventCtrlWheel);
    };
  }, []);

  return null;
}
