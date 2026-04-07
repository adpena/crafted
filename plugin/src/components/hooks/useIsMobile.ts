import { useState, useEffect } from "react";

/**
 * Returns true when the viewport width is at or below the given breakpoint.
 * Uses window.matchMedia for efficient change detection.
 *
 * @param breakpoint - CSS pixel width (default: 768)
 */
export function useIsMobile(breakpoint = 768): boolean {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
		setIsMobile(mql.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, [breakpoint]);

	return isMobile;
}
