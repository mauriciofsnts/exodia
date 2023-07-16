import axios from 'axios';
import Jimp from 'jimp';

async function returnImageBase64(url: string): Promise<string | void> {
	const base64 = await axios
		.get(url, {
			responseType: 'arraybuffer',
		})
		.then((response) => {
			const base64 = Buffer.from(response.data, 'binary').toString('base64');
			return base64;
		})
		.catch((error) => {
			console.log(error);
		});

	return base64;
}

export class QuoteGenerator {
	private MAX_CHARS_PER_LINE = 32;

	private breakTextToLines = (text: string, maxCharsPerLine: number) => {
		const words = text.trim().split(' ');
		const lines: string[] = [];
		let charCount = 0;
		let currLine = '';

		for (const word of words) {
			if (!word) continue;

			if (charCount + word.length > maxCharsPerLine) {
				lines.push(currLine.trim());
				currLine = '';
				charCount = 0;
			}
			else if (currLine !== '') {
				currLine += ' ';
			}
			charCount += word.length;
			currLine += word;
		}

		if (currLine !== '') {
			lines.push(currLine.trim());
		}

		if (lines.length === 0) {
			lines.push(currLine);
		}

		return lines;
	};

	private addTextToImage = async (
		image: Jimp,
		text: string,
		spaceBetweenLines: number,
		font: any,
	) => {
		const IMAGE_SIZE = image.getWidth();
		const HEIGHT_SIZE = image.getHeight();

		const lines = this.breakTextToLines(text, this.MAX_CHARS_PER_LINE);
		let textWidth = Jimp.measureText(font, lines[0]);
		const singleLineHeight = Jimp.measureTextHeight(font, 'a', textWidth);
		const allTextHeight = singleLineHeight * lines.length;

		image.print(
			font,
			IMAGE_SIZE / 2 - textWidth / 2,
			HEIGHT_SIZE / 2 - allTextHeight / 2,
			lines[0],
			textWidth,
			singleLineHeight,
			(err, image, { y }) => {
				if (err) {
					throw err;
				}
				for (let i = 1; i < lines.length; i++) {
					textWidth = Jimp.measureText(font, lines[i]);
					image.print(
						font,
						IMAGE_SIZE / 2 - textWidth / 2,
						y + singleLineHeight * (i - 1) + spaceBetweenLines * i,
						lines[i],
						textWidth,
						singleLineHeight,
					);
				}
			},
		);
	};

	async createImageWithText(text: string) {
		try {
			const backgroundImage = await returnImageBase64(
				'https://picsum.photos/800/600',
			);
			if (!backgroundImage) return console.log('No image found');

			const buffer = Buffer.from(backgroundImage, 'base64');
			const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

			const image = await Jimp.read(buffer).then(async (img) => {
				const imageWidth = img.getWidth();
				const imageHeight = img.getHeight();

				const textWidth = Jimp.measureText(font, text);
				const textHeight = Jimp.measureTextHeight(font, text, imageWidth);

				// Define the dimensions of the text container with larger padding
				const containerWidth = textWidth + 160;
				const containerHeight = textHeight + 80;
				const containerX = (imageWidth - containerWidth) / 2;
				const containerY = (imageHeight - containerHeight) / 2;

				img.composite(
					(
						await Jimp.create(containerWidth, containerHeight, 0xffffffff)
					).opacity(0.2),
					containerX,
					containerY,
				);

				this.addTextToImage(img, text, 10, font);

				return img;
			});

			return image;
		}
		catch (error) {
			console.error('Ocorreu um erro:', error);
		}
	}
}
