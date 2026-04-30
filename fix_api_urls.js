
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx')) results.push(file);
    }
  });
  return results;
}

const files = walk('c:/Users/oumar/HotelOS/src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('process.env.REACT_APP_API_URL || \'\'')) {
    const relativePath = path.relative(path.dirname(f), 'c:/Users/oumar/HotelOS/src/config.js').replace(/\\\\/g, '/');
    const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
    
    let parts = content.split('\n');
    if (!content.includes('import { API_BASE }')) {
      const importIdx = parts.findIndex(p => !p.startsWith('import '));
      parts.splice(importIdx, 0, \import { API_BASE } from '\';\);
    }
    
    const newContent = parts.join('\n').replace(/\\\$\\{process\\.env\\.REACT_APP_API_URL \\|\\| ''\\}/g, '\\');
    fs.writeFileSync(f, newContent);
    console.log('Updated', f);
  }
});

