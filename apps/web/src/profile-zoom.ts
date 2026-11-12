export const ZOOM_FROM = 2300

export const ZOOM_MIN = 1440 / ZOOM_FROM

export const pageZoom = (width: number) => Math.max(ZOOM_MIN, width / ZOOM_FROM)

export const liveZoom = () => (typeof document === 'undefined' ? 1 : parseFloat(document.body.style.zoom) || 1)
