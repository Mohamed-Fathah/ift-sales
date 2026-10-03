const fs = require('fs')

const packageJsonStr = fs.readFileSync('package.json', 'utf8')
const packageJson = JSON.parse(packageJsonStr)

packageJson.build = {
  "appId": "com.ifterp.desktop",
  "productName": "IFT ERP",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "main.js",
    "package.json",
    ".next/standalone/**/*",
    ".next/static/**/*",
    "public/**/*"
  ],
  "extraResources": [
    {
      "from": ".next/static",
      "to": "app/.next/static"
    },
    {
      "from": "public",
      "to": "app/public"
    }
  ]
}

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
