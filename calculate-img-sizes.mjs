import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import readline from "readline";

async function getImageSizes(url, breakpoints, pageName) {
	console.log(`🖼 Calculating image sizes for ${pageName} at ${url} using breakpoints ${breakpoints}`);

	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	const imageSizesMap = new Map();
	const screenshotsDir = path.resolve("screenshots");

	if (!fs.existsSync(screenshotsDir)) {
		fs.mkdirSync(screenshotsDir);
	}

	for (const breakpoint of breakpoints) {
		await page.setViewport({ width: breakpoint, height: 800 });
		try {
			await page.goto(url, { waitUntil: "networkidle0" });
		} catch (err) {
			console.error(`❌ Failed to navigate to ${url} at ${breakpoint}px:`, err.message);
			break;
		}

		const fullPageScreenshotPath = path.join(
			screenshotsDir,
			`${pageName}_${breakpoint}px.png`
		);
		try {
			await page.screenshot({ path: fullPageScreenshotPath, fullPage: true });
			console.log(`✅ Full-page screenshot saved: ${fullPageScreenshotPath}`);
		} catch (err) {
			console.error(`❌ Failed to capture full-page screenshot at ${breakpoint}px:`, err);
		}

		const images = await page.evaluate(() => {
			return Array.from(document.images).map((img) => ({
				src: img.src,
				width: img.width,
				currentSizes: img.getAttribute("sizes") || "",
			}));
		});

		for (const img of images) {
			if (!imageSizesMap.has(img.src)) {
				imageSizesMap.set(img.src, {
					entries: [],
					currentSizes: img.currentSizes,
				});
			}
			imageSizesMap
				.get(img.src)
				.entries.push({ breakpoint, vw: (img.width / breakpoint) * 100 });
		}
	}

	await browser.close();

	const results = {};

	imageSizesMap.forEach((data, src) => {
		const { entries, currentSizes } = data;
		const sizes = [];

		for (let i = 0; i < entries.length; i++) {
			const current = entries[i];
			const prev = i > 0 ? entries[i - 1] : null;

			const vw = Math.round(current.vw);

			if (!prev || Math.round(prev.vw) !== vw) {
				if (i < entries.length - 1) {
					sizes.push(`(min-width: ${current.breakpoint}px) ${vw}vw`);
				} else {
					sizes.push(`${vw}vw`);
				}
			}
		}

		const suggestedSizes = sizes.join(", ");

		results[src] = {
			suggestedSizes,
			currentSizes,
			match: suggestedSizes === currentSizes,
		};
	});

	return results;
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const defaultBreakpoints = [640, 768, 1024, 1280, 1536];
const defaultPageName = "page";

rl.question("Enter the URL to analyze: ", (answerUrl) => {
	if (answerUrl.trim() === '') {
		console.error("❌ Invalid URL");
		rl.close();
	}

	rl.question(`Enter the breakpoints (default: ${defaultBreakpoints}): `, (answerBreakpoints) => {
		let breakpoints;

		if (answerBreakpoints.trim() === '') {
			breakpoints = defaultBreakpoints;
		} else {
			breakpoints = answerBreakpoints
				.split(',')
				.map(n => parseFloat(n.trim()))
				.filter(n => !isNaN(n));
		}

		rl.question("Enter the page name: ", (answerPageName) => {
			const pageName = answerPageName.trim() === '' ? defaultPageName : answerPageName;

			getImageSizes(answerUrl, breakpoints, pageName)
				.then((result) => {
					if (Object.keys(result).length === 0) {
						console.log("⚠️ No images found on the page.");
						return;
					}

					const mismatches = Object.entries(result).filter(([_, { match }]) => !match);

					if (mismatches.length > 0) {
						console.error("❌ Mismatched image sizes:");
						mismatches.forEach(([src, { suggestedSizes, currentSizes }]) => {
							console.log(`Image: ${src}`);
							console.log(`  Current sizes: ${currentSizes}`);
							console.log(`  Suggested sizes: ${suggestedSizes}`);
						});
					} else {
						console.log("🎉 All images have matching sizes.");
					}
				})
				.catch((err) => {
					console.error("❌ Error computing image sizes:", err);
				})
				.finally(() => {
					rl.close();
				});
		});
	});
});
