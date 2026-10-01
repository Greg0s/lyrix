import type { MouseEvent, ReactNode } from "react";
import { routePath, type Route } from "../routes";

interface RouteLinkProps {
  to: Route;
  onNavigate: (to: Route) => void;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}

/**
 * A link to one of the game's screens: a real `<a href>`, so it can be opened
 * in a new tab or copied, that changes screen in place on a plain click.
 */
export function RouteLink({ to, onNavigate, className, children, ...rest }: RouteLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, a download: the browser's to handle.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  return (
    <a href={routePath(to)} className={className} onClick={onClick} aria-label={rest["aria-label"]}>
      {children}
    </a>
  );
}
