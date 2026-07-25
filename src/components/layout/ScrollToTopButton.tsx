"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="맨 위로 이동"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 bottom-24 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-all hover:bg-violet-700 md:bottom-6",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
