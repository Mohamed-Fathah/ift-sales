const fs = require('fs')

const packageJsonStr = fs.readFileSync('package.json', 'utf8')
const packageJson = JSON.parse(packageJsonStr)

packageJson.main = "main.js"

packageJson.scripts["electron-dev"] = "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\""
packageJson.scripts["electron-build"] = "npm run build && electron-builder"

packageJson.build = {
  "appId": "com.ifterp.desktop",
  "productName": "IFT ERP",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "main.js",
    "package.json"
  ]
}

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
