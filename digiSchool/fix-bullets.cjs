const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      if (dirPath.endsWith('.jsx') || dirPath.endsWith('.js')) {
        callback(dirPath);
      }
    }
  });
}

let count = 0;
walkDir(path.join(__dirname, 'src'), function(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the literal unicode bullet with ' | '
  // Using global regex for the unicode character
  let newContent = content.replace(/\u2022/g, ' | ');
  
  // Also replace any literal 'â€¢' just in case
  newContent = newContent.replace(/â€¢/g, ' | ');
  newContent = newContent.replace(/Ã¢â‚¬Â¢/g, ' | ');
  newContent = newContent.replace(/â†’/g, ' -> ');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Fixed text in ${filePath}`);
    count++;
  }
});

console.log(`Fixed ${count} files.`);
