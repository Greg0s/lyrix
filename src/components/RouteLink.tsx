import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { routePath, type Route } from "../routes";

interface RouteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  to: Route;
  onNavigate: (to: Route) => void;
  children: ReactNode;
}

/**
 * A link to one of the game's screens: a real `<a href>`, so it can be opened
 * in a new tab or copied, that changes screen in place on a plain click.
 */
export function RouteLink({ to, onNavigate, children, ...rest }: RouteLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, a download: the browser's to handle.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  return (
    <a {...rest} href={routePath(to)} onClick={onClick}>
      {children}
    </a>
  );
}
