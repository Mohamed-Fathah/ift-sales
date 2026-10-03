const fs = require('fs')

let mainContent = fs.readFileSync('main.js', 'utf8')

// Adjust the script to correctly serve static resources like public/ and .next/static/ by copying them properly
// or making the standalone server aware of them since Electron copies them using extraResources.
// But Next.js standalone actually requires 'public' and '.next/static' to be in the same folder as 'server.js'.
// Let's modify main.js to setup a small proxy or just ensure the paths are correct.
// Actually, next standalone handles this natively if they are copied to .next/standalone/public and .next/standalone/.next/static.

const packageJsonStr = fs.readFileSync('package.json', 'utf8')
const packageJson = JSON.parse(packageJsonStr)

packageJson.build.extraResources = [
  {
    "from": ".next/static",
    "to": "app/.next/standalone/.next/static"
  },
  {
    "from": "public",
    "to": "app/.next/standalone/public"
  }
];

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
