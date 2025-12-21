const fs = require("fs");
const path = require("path");

const folder = path.join(__dirname, "..", "public", "platforms");
const manifestPath = path.join(folder, "manifest.json");

function run() {
  if (!fs.existsSync(folder)) {
    console.error("platforms folder does not exist:", folder);
    process.exit(1);
  }

  const files = fs.readdirSync(folder);
  const svgs = files
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .map((f) => path.basename(f, ".svg"));

  fs.writeFileSync(manifestPath, JSON.stringify(svgs, null, 2));

  console.log(`✔ Auto-generated manifest.json (${svgs.length} icons)`);
}

run();
