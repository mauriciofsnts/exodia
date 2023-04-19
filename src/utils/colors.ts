type RGBColor = [number, number, number]
type HSVColor = [number, number, number]
type HSLColor = [number, number, number]
type CMYKColor = [number, number, number, number]

interface ColorValues {
  rgb: RGBColor
  hsv: HSVColor
  hsl: HSLColor
  cmyk: CMYKColor
}

interface ColorFormated {
  rgb: string
  hsv: string
  hsl: string
  cmyk: string
  hex: string
}

export function getColorValuesFormated(hexColor: string): ColorFormated {
	const values = hexToColorValues(hexColor);

	const hsv = values.hsv.map((value) => (value * 100).toFixed(0) + '%');

	const hsl = values.hsl.map((value) => (value * 100).toFixed(0) + '%');

	const cmyk = values.cmyk.map((value) => (value * 100).toFixed(0) + '%');

	const hex = hexColor.toUpperCase();

	return {
		rgb: values.rgb.join(', '),
		hsv: hsv.join(', '),
		hsl: hsl.join(', '),
		cmyk: cmyk.join(', '),
		hex,
	};
}

function hexToColorValues(hexColor: string): ColorValues {
	// remove o # do início da string, se existir
	hexColor = hexColor.replace('#', '');

	// converte o hexadecimal para RGB
	const r = parseInt(hexColor.substring(0, 2), 16);
	const g = parseInt(hexColor.substring(2, 4), 16);
	const b = parseInt(hexColor.substring(4, 6), 16);
	const rgb: RGBColor = [r, g, b];

	// converte o RGB para HSV
	const hsv: HSVColor = rgbToHsv(r, g, b);

	// converte o RGB para HSL
	const hsl: HSLColor = rgbToHsl(r, g, b);

	// converte o RGB para CMYK
	const cmyk: CMYKColor = rgbToCmyk(r, g, b);

	return { rgb, hsv, hsl, cmyk };
}

function rgbToHsv(r: number, g: number, b: number): HSVColor {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const s = max === 0 ? 0 : d / max;
	const v = max / 255;
	let h: any;

	switch (max) {
	case min:
		h = 0;
		break;
	case r:
		h = (g - b) / d + (g < b ? 6 : 0);
		break;
	case g:
		h = (b - r) / d + 2;
		break;
	case b:
		h = (r - g) / d + 4;
		break;
	}

	h /= 6;

	return [h, s, v];
}

function rgbToHsl(r: number, g: number, b: number): HSLColor {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;

	if (d !== 0) {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
		case r:
			h = (g - b) / d + (g < b ? 6 : 0);
			break;
		case g:
			h = (b - r) / d + 2;
			break;
		case b:
			h = (r - g) / d + 4;
			break;
		}

		h /= 6;
	}

	return [h, s, l];
}

function rgbToCmyk(r: number, g: number, b: number): CMYKColor {
	const c = 1 - r / 255;
	const m = 1 - g / 255;
	const y = 1 - b / 255;
	const k = Math.min(c, m, y);
	const denominator = k === 1 ? 1 : 1 - k;
	const cyan = (c - k) / denominator || 0;
	const magenta = (m - k) / denominator || 0;
	const yellow = (y - k) / denominator || 0;
	return [cyan, magenta, yellow, k];
}
