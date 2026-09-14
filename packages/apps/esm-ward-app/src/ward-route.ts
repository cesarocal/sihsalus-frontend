import { useSyncExternalStore } from 'react';
import { useInRouterContext, useParams } from 'react-router-dom';

export function getWardViewBasename() {
  const spaBase = window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa';
  return `${spaBase.replace(/\/+$/, '')}/home/ward`;
}

function isLocationUuid(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' && !/[/\\?#\s\p{Cc}]/u.test(value)
  );
}

export function getWardLocationUuidFromPathname(pathname: string): string | undefined {
  const prefix = `${getWardViewBasename()}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const segment = pathname.slice(prefix.length).replace(/\/$/, '');
  try {
    const uuid = decodeURIComponent(segment);
    return isLocationUuid(uuid) ? uuid : undefined;
  } catch {
    return undefined;
  }
}

function subscribeToRouteChanges(onChange: () => void) {
  window.addEventListener('single-spa:routing-event', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('single-spa:routing-event', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const noSubscription = () => () => {};
const getPathname = () => window.location.pathname;

export function useWardLocationUuid(): string | undefined {
  const inRouter = useInRouterContext();
  const { locationUuid } = useParams();
  // Ward extensions and workspaces are separate React roots; they cannot inherit
  // the dashboard's Router. Read a current URL snapshot in those roots instead.
  const pathname = useSyncExternalStore(inRouter ? noSubscription : subscribeToRouteChanges, getPathname);
  return inRouter
    ? isLocationUuid(locationUuid)
      ? locationUuid
      : undefined
    : getWardLocationUuidFromPathname(pathname);
}
