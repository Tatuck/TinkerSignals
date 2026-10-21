/** Imagen RGBA tal como la usa el navegador. */
export interface RgbaImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/**
 * Lado mayor de una imagen cargada. Más grande no aporta nada para aprender
 * y haría lento recalcular la cadena cada vez que se mueve un deslizador.
 */
export const MAX_IMAGE_SIDE = 512;

/**
 * Decodifica un archivo de imagen (PNG, JPEG, WebP…) y lo reduce para que su
 * lado mayor no pase de `maxSide`. El tamaño se redondea a un múltiplo de 16
 * para que encajen los bloques 8×8 y los macrobloques del submuestreo 4:2:0.
 */
export async function decodeImage(file: Blob, maxSide = MAX_IMAGE_SIDE): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const round16 = (v: number) => Math.max(16, Math.round((v * scale) / 16) * 16);
  const width = round16(bitmap.width);
  const height = round16(bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, rgba: ctx.getImageData(0, 0, width, height).data };
}

/** Descarga una imagen RGBA como PNG. */
export function downloadPng(img: RgbaImage, name: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(img.rgba), img.width, img.height), 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
