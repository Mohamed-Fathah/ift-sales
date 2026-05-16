const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const dbJs = fs.readFileSync('db.js', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

html = html.replace('<link rel="stylesheet" href="style.css?v=2" />', `<style>\n${css}\n</style>`);
html = html.replace('<script src="db.js"></script>', `<script>\n${dbJs}\n</script>`);
html = html.replace('<script src="app.js"></script>', `<script>\n${appJs}\n</script>`);

fs.writeFileSync('ift-sales-portable.html', html);
console.log('Successfully created ift-sales-portable.html');
