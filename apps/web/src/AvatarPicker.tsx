"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import { apiMode, apiUrl } from "./api";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import { CloseIcon, PictureIcon } from "./icons";

const BOX = 300;
const OUT = 512;
const LIMIT = 6 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const KINDS = [
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/avif",
];

type Shot = { image: HTMLImageElement; base: number };
type Spot = { x: number; y: number };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export default function AvatarPicker() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const file = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const touches = useRef(new Map<number, Spot>());
  const pinch = useRef<{
    gap: number;
    zoom: number;
    at: Spot;
    mid: Spot;
  } | null>(null);
  const drag = useRef<Spot | null>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [zoom, setZoom] = useState(1);
  const [at, setAt] = useState<Spot>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fence = useCallback(
    (spot: Spot, next: number, image: HTMLImageElement, base: number) => {
      const width = image.width * base * next;
      const height = image.height * base * next;
      const roomX = Math.max(0, (width - BOX) / 2);
      const roomY = Math.max(0, (height - BOX) / 2);
      return {
        x: clamp(spot.x, -roomX, roomX),
        y: clamp(spot.y, -roomY, roomY),
      };
    },
    [],
  );

  const draw = useCallback(() => {
    const board = canvas.current;
    if (!board || !shot) return;
    const ctx = board.getContext("2d");
    if (!ctx) return;
    const size = shot.base * zoom;
    const width = shot.image.width * size;
    const height = shot.image.height * size;
    ctx.clearRect(0, 0, BOX, BOX);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      shot.image,
      BOX / 2 - width / 2 + at.x,
      BOX / 2 - height / 2 + at.y,
      width,
      height,
    );
  }, [at.x, at.y, shot, zoom]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    draw();
  }, [draw, open]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setShot(null);
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  });

  const take = (picked: File | undefined | null) => {
    setError(null);
    if (!picked) return;
    if (!KINDS.includes(picked.type)) return setError(t("avatar.badKind"));
    if (picked.size > LIMIT) return setError(t("avatar.tooBig"));

    const url = URL.createObjectURL(picked);
    const image = new Image();
    image.onload = () => {
      setShot({ image, base: Math.max(BOX / image.width, BOX / image.height) });
      setZoom(1);
      setAt({ x: 0, y: 0 });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      setError(t("avatar.badKind"));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    take(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files?.[0]);
  };

  const scaleTo = (next: number, cx: number, cy: number) => {
    if (!shot) return;
    const limited = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const factor = limited / zoom;
    const spot = { x: cx - (cx - at.x) * factor, y: cy - (cy - at.y) * factor };
    setZoom(limited);
    setAt(fence(spot, limited, shot.image, shot.base));
  };

  const spotOf = (
    event: PointerEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>,
  ) => {
    const box = (event.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: event.clientX - box.left - BOX / 2,
      y: event.clientY - box.top - BOX / 2,
    };
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (!shot) return;
    const spot = spotOf(event);
    scaleTo(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), spot.x, spot.y);
  };

  const grab = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!shot) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* вказівник уже відпущено */
    }
    touches.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (touches.current.size === 2) {
      const [one, two] = [...touches.current.values()];
      const box = event.currentTarget.getBoundingClientRect();
      pinch.current = {
        gap: Math.hypot(one.x - two.x, one.y - two.y),
        zoom,
        at,
        mid: {
          x: (one.x + two.x) / 2 - box.left - BOX / 2,
          y: (one.y + two.y) / 2 - box.top - BOX / 2,
        },
      };
      drag.current = null;
      return;
    }

    drag.current = { x: event.clientX - at.x, y: event.clientY - at.y };
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!shot || !touches.current.has(event.pointerId)) return;
    touches.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pinch.current && touches.current.size >= 2) {
      const [one, two] = [...touches.current.values()];
      const gap = Math.hypot(one.x - two.x, one.y - two.y);
      const start = pinch.current;
      const next = clamp((start.zoom * gap) / start.gap, MIN_ZOOM, MAX_ZOOM);
      const factor = next / start.zoom;
      const spot = {
        x: start.mid.x - (start.mid.x - start.at.x) * factor,
        y: start.mid.y - (start.mid.y - start.at.y) * factor,
      };
      setZoom(next);
      setAt(fence(spot, next, shot.image, shot.base));
      return;
    }

    if (!drag.current) return;
    setAt(
      fence(
        {
          x: event.clientX - drag.current.x,
          y: event.clientY - drag.current.y,
        },
        zoom,
        shot.image,
        shot.base,
      ),
    );
  };

  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (!touches.current.size) drag.current = null;
  };

  const send = async (body: FormData) => {
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl("profile/avatar"), {
      method: "POST",
      credentials: apiMode(),
      body,
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(t("avatar.failed"));
      return false;
    }
    await refresh();
    return true;
  };

  const save = async () => {
    const board = canvas.current;
    if (!board || !shot) return;
    const out = document.createElement("canvas");
    out.width = OUT;
    out.height = OUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(board, 0, 0, BOX, BOX, 0, 0, OUT, OUT);

    const blob = await new Promise<Blob | null>((done) =>
      out.toBlob(done, "image/webp", 0.9),
    );
    if (!blob) return setError(t("avatar.failed"));

    const body = new FormData();
    body.append("file", blob, "avatar.webp");
    if (await send(body)) {
      setShot(null);
      setOpen(false);
    }
  };

  const remove = async () => {
    const body = new FormData();
    body.append("action", "remove");
    if (await send(body)) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="ava-trigger"
        onClick={() => setOpen(true)}
        aria-label={t("avatar.change")}
      >
        <Avatar
          id={user?.id}
          name={user?.nickname ?? "?"}
          avatar={user?.avatar}
          frame={user?.frame}
          hint={
            <span className="ava-hover" aria-hidden>
              <PictureIcon />
            </span>
          }
        />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="modal-backdrop" onClick={close} role="presentation">
            <section
              className="card modal ava-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("avatar.title")}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                onClick={close}
                aria-label={t("profile.cancel")}
              >
                <CloseIcon />
              </button>
              <h2>{t("avatar.title")}</h2>

              {shot ? (
                <>
                  <canvas
                    ref={canvas}
                    className="ava-canvas"
                    width={BOX}
                    height={BOX}
                    onPointerDown={grab}
                    onPointerMove={move}
                    onPointerUp={release}
                    onPointerCancel={release}
                    onWheel={onWheel}
                  />
                  <p className="muted small ava-tip">{t("avatar.frame")}</p>
                  <div className="ava-actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() => setShot(null)}
                    >
                      {t("avatar.another")}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      {busy ? t("avatar.saving") : t("avatar.save")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="muted ava-lead">{t("avatar.hint")}</p>
                  <div
                    className={`ava-drop ${over ? "over" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={onDrop}
                    onClick={() => file.current?.click()}
                    role="presentation"
                  >
                    <span className="ava-mark" aria-hidden>
                      <PictureIcon />
                    </span>
                    <b>{t("avatar.pick")}</b>
                    <small>{t("avatar.kinds")}</small>
                  </div>
                  {user?.avatar && (
                    <button
                      type="button"
                      className="ghost ava-drop-pic"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      <CloseIcon />
                      {t("avatar.remove")}
                    </button>
                  )}
                </>
              )}

              <input
                ref={file}
                type="file"
                accept={KINDS.join(",")}
                hidden
                onChange={onPick}
              />
              {error && <p className="notice error ava-error">{error}</p>}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
