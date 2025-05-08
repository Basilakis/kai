const fs = require('fs');
const path = require('path');

// Directory containing the processed markdown files
const docsDir = '../kai-docs-temp/docs';

// Map of file paths to their categories
const filePathMap = {};

// Function to recursively find all markdown files
function findMarkdownFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
      
      // Store the file path in the map
      const relativePath = path.relative(docsDir, fullPath);
      const id = relativePath.replace(/\.md$/, '');
      filePathMap[path.basename(item)] = id;
    }
  }
  
  return files;
}

// Function to fix links in a markdown file
function fixLinksInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Find all markdown links: [text](./file.md)
    const linkRegex = /\[([^\]]+)\]\(\.\/([^)]+)\.md\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, linkText, linkPath] = match;
      const linkFile = path.basename(linkPath) + '.md';
      
      // Check if we have this file in our map
      if (filePathMap[linkFile]) {
        const newLink = `[${linkText}](/${filePathMap[linkFile]})`;
        content = content.replace(fullMatch, newLink);
        modified = true;
        console.log(`Fixed link in ${filePath}: ${fullMatch} -> ${newLink}`);
      } else {
        console.log(`Warning: Could not resolve link in ${filePath}: ${fullMatch}`);
      }
    }
    
    // Also fix links with ../ prefix
    const parentLinkRegex = /\[([^\]]+)\]\(\.\.\/(.*?)\.md\)/g;
    while ((match = parentLinkRegex.exec(content)) !== null) {
      const [fullMatch, linkText, linkPath] = match;
      const linkFile = path.basename(linkPath) + '.md';
      
      // Check if we have this file in our map
      if (filePathMap[linkFile]) {
        const newLink = `[${linkText}](/${filePathMap[linkFile]})`;
        content = content.replace(fullMatch, newLink);
        modified = true;
        console.log(`Fixed parent link in ${filePath}: ${fullMatch} -> ${newLink}`);
      } else {
        console.log(`Warning: Could not resolve parent link in ${filePath}: ${fullMatch}`);
      }
    }
    
    // Save the file if it was modified
    if (modified) {
      fs.writeFileSync(filePath, content);
    }
    
    return modified;
  } catch (error) {
    console.error(`Error fixing links in ${filePath}:`, error);
    return false;
  }
}

// Main function
function main() {
  try {
    console.log('Starting to fix markdown links...');
    
    // Find all markdown files
    const files = findMarkdownFiles(docsDir);
    console.log(`Found ${files.length} markdown files.`);
    
    // Fix links in each file
    let fixedCount = 0;
    for (const file of files) {
      if (fixLinksInFile(file)) {
        fixedCount++;
      }
    }
    
    console.log(`Fixed links in ${fixedCount} files.`);
  } catch (error) {
    console.error('Error fixing markdown links:', error);
    process.exit(1);
  }
}

// Run the main function
main();
