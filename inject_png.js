const fs = require('fs');
const b64 = fs.readFileSync('book_encoded.txt', 'utf8');

// Replace in index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(
    /<button id="bookBtn"[\s\S]*?<\/button>/,
    `<button id="bookBtn" class="audio-btn" title="Inhalt" tabindex="-1">
        <img src="data:image/png;base64,${b64}" style="width: 20px; height: 20px; filter: brightness(0) invert(1);" alt="Buch">
    </button>`
);
fs.writeFileSync('index.html', indexHtml);

// Replace in liminal library.html
let liminalHtml = fs.readFileSync('liminal library.html', 'utf8');
liminalHtml = liminalHtml.replace(
    /<button id="bookBtn"[\s\S]*?<\/button>/,
    `<button id="bookBtn" class="audio-btn" title="Inhalt">
        <img src="data:image/png;base64,${b64}" style="width: 24px; height: 24px; filter: brightness(0) invert(1);" alt="Buch">
    </button>`
);
fs.writeFileSync('liminal library.html', liminalHtml);

console.log('Icons replaced with exact PNG base64 representation.');
