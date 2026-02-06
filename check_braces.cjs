
const fs = require('fs');
const content = fs.readFileSync('c:/chatapp/App.tsx', 'utf8');
const lines = content.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let char of line) {
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        console.log(`Depth hit 0 at line ${i + 1}: ${line.trim()}`);
      }
    }
    if (depth < 0) {
      console.log(`Extra closing brace at line ${i + 1}: ${line}`);
      process.exit(1);
    }
  }
}
console.log(`Final depth: ${depth}`);
