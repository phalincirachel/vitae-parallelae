const fs = require('fs');
const pixels = require('image-pixels');

async function run() {
    let data = await pixels('bookpng.png');
    let w = data.width, h = data.height;
    let px = data.data;
    let lines = [];

    // Check if the image has transparency to decide what makes a pixel "visible"
    // Usually icons have alpha, but sometimes they are black on white.
    // Let's assume darker pixels or opaque pixels are the drawn lines.

    const step = Math.max(1, Math.floor(w / 80)); // scale down for terminal

    for (let y = 0; y < h; y += step) {
        let row = '';
        for (let x = 0; x < w; x += step) {
            let i = (y * w + x) * 4;
            let r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];

            // If it's a black/dark line on transparent or white background
            let isDark = (r < 128 && g < 128 && b < 128);
            let isOpaque = (a > 128);

            if (isOpaque && isDark) {
                row += '#';
            } else if (isOpaque && !isDark) {
                row += '.'; // maybe white background
            } else {
                row += ' ';
            }
        }
        lines.push(row);
    }
    fs.writeFileSync('book_ascii.txt', lines.join('\n'));
    console.log("ASCII written to book_ascii.txt");
}
run().catch(console.error);
