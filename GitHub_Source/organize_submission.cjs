const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const OUTPUT_DIR = path.join(ROOT, '_SUBMISSION');
const ITCH_DIR = path.join(OUTPUT_DIR, 'Itch_IO_Build');
const GITHUB_DIR = path.join(OUTPUT_DIR, 'GitHub_Source');

// Ensure clean output dirs
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR);
fs.mkdirSync(ITCH_DIR);
fs.mkdirSync(GITHUB_DIR);

console.log("Created Submission Folders...");

// 1. Copy Dist to Itch
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
    fs.cpSync(DIST, ITCH_DIR, { recursive: true });
    console.log("Copied Build to Itch Folder.");
} else {
    console.error("Dist folder not found! Build failed?");
}

// 2. Copy Source to GitHub (Filtering)
const EXCLUDES = ['.git', 'node_modules', 'dist', '_SUBMISSION', '.vscode', '.idea'];

function copySource(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        if (EXCLUDES.includes(entry.name)) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copySource(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log("Copying Source Code...");
copySource(ROOT, GITHUB_DIR);
console.log("Done! Check the '_SUBMISSION' folder.");
