/**
 * 打包脚本：将 index.html + css/style.css + js/config.js + js/game.js
 * 合并为一个自包含的 dist/元素合成实验室.html 文件
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf-8');
const configJs = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf-8');
const gameJs = fs.readFileSync(path.join(root, 'js', 'game.js'), 'utf-8');

let output = html;

// 替换外部 CSS 引用为内联 <style>
output = output.replace(
    /<link rel="stylesheet" href="css\/style\.css">/,
    `<style>\n${css}\n</style>`
);

// 替换外部 JS 引用为内联 <script>
output = output.replace(
    /<script src="js\/config\.js"><\/script>\s*<script src="js\/game\.js"><\/script>/,
    `<script>\n${configJs}\n\n${gameJs}\n</script>`
);

const distDir = path.join(root, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const outPath = path.join(distDir, '元素合成实验室.html');
fs.writeFileSync(outPath, output, 'utf-8');

const sizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1);
console.log(`Done! => dist/元素合成实验室.html (${sizeKB} KB)`);
