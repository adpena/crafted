import type { ReactNode, CSSProperties } from "react";

export type TransitionProps = {
  show: boolean;
  children: ReactNode;
};

const baseStyle: CSSProperties = {
  transition: "opacity 300ms ease-out, transform 300ms ease-out",
  willChange: "opacity, transform",
};

const hiddenStyle: CSSProperties = {
  ...baseStyle,
  opacity: 0,
  transform: "translateY(10px)",
  pointerEvents: "none",
};

const visibleStyle: CSSProperties = {
  ...baseStyle,
  opacity: 1,
  transform: "translateY(0)",
};

export function Transition({ show, children }: TransitionProps) {
  return (
    <div style={show ? visibleStyle : hiddenStyle} aria-hidden={!show}>
      {children}
    </div>
  );
}
