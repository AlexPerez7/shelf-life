// Lectura de códigos de barras con la API del navegador (Chrome en Android).

// BarcodeDetector todavía no está en los tipos de TypeScript.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike

/** El constructor de BarcodeDetector, si el navegador lo tiene. */
export function barcodeDetector(): BarcodeDetectorCtor | null {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null
}

/** Si el navegador puede leer códigos de barras (Chrome en Android, sí; Safari, no). */
export function canScanBarcodes() {
  return typeof window !== 'undefined' && barcodeDetector() != null && !!navigator.mediaDevices?.getUserMedia
}
