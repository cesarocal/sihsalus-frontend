import { useEffect, useRef, useState } from 'react';

export function useVisualQueueFullscreen() {
  const boardRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenPending, setIsFullscreenPending] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const isFullscreenSupported =
    typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen && document.exitFullscreen);

  useEffect(() => {
    const board = boardRef.current;
    let wasFullscreen = false;
    const handleFullscreenChange = () => {
      const isBoardFullscreen = document.fullscreenElement === board;
      setIsFullscreen(isBoardFullscreen);
      setFullscreenError(false);
      if (isBoardFullscreen || wasFullscreen) {
        fullscreenButtonRef.current?.focus({ preventScroll: true });
      }
      wasFullscreen = isBoardFullscreen;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === board) {
        // Keep the browser's native Escape behavior, and handle environments
        // that deliver the key to the page without exiting fullscreen for us.
        void document.exitFullscreen().catch(() => {
          if (document.fullscreenElement === board) {
            setFullscreenError(true);
          }
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = async () => {
    const board = boardRef.current;
    if (!board || !isFullscreenSupported || isFullscreenPending) {
      return;
    }

    setIsFullscreenPending(true);
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === board) {
        await document.exitFullscreen();
      } else {
        await board.requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
    } finally {
      setIsFullscreenPending(false);
    }
  };

  return {
    boardRef,
    fullscreenButtonRef,
    isFullscreen,
    isFullscreenSupported,
    isFullscreenPending,
    fullscreenError,
    toggleFullscreen,
  };
}
