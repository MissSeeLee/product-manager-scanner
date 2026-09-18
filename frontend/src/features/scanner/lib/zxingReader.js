import { readBarcodes } from "zxing-wasm/reader";

const READER_OPTIONS = {
  tryHarder: true,

  formats: ["Code128", "Code39", "QRCode", "DataMatrix"],

  maxNumberOfSymbols: 1,
};

export async function decodeBarcode(imageData) {
  const results = await readBarcodes(imageData, READER_OPTIONS);

  const result = results[0];

  if (!result?.text) {
    return null;
  }

  const value = result.text.trim();

  if (!value) {
    return null;
  }

  return {
    value,
    format: result.format,
    symbology: result.symbology,
  };
}
