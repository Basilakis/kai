const fs = require('fs');
const path = require('path');

// Directory containing the processed markdown files
const docsDir = path.resolve(__dirname, '../../kai-docs-temp/docs');

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
    }
  }

  return files;
}

// Function to remove links and images in a markdown file
function removeLinksInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Find all markdown links: [text](./file.md) or [text](../file.md)
    const linkRegex = /\[([^\]]+)\]\((\.\.?\/[^)]+\.md)\)/g;

    // Replace links with just the text
    let newContent = content.replace(linkRegex, (match, text) => {
      modified = true;
      return text;
    });

    // Remove image references: ![alt text](./image.png)
    const imageRegex = /!\[.*?\]\(.*?\)/g;
    newContent = newContent.replace(imageRegex, () => {
      modified = true;
      return ''; // Replace with empty string
    });

    // Remove HTML image tags: <img src="..." />
    const htmlImageRegex = /<img[^>]*>/g;
    newContent = newContent.replace(htmlImageRegex, () => {
      modified = true;
      return ''; // Replace with empty string
    });

    // Remove JSX code blocks
    const jsxCodeBlockRegex = /```jsx[\s\S]*?```/g;
    newContent = newContent.replace(jsxCodeBlockRegex, () => {
      modified = true;
      return '```\nJSX code removed for compatibility\n```'; // Replace with a placeholder
    });

    // Remove JavaScript code blocks
    const jsCodeBlockRegex = /```js(?:cript)?[\s\S]*?```/g;
    newContent = newContent.replace(jsCodeBlockRegex, () => {
      modified = true;
      return '```\nJavaScript code removed for compatibility\n```'; // Replace with a placeholder
    });

    // Remove curly braces that might be interpreted as JSX expressions
    const curlyBracesRegex = /{[^}]*}/g;
    newContent = newContent.replace(curlyBracesRegex, (match) => {
      // Don't replace if it's inside a code block
      if (match.includes('\n')) {
        return match;
      }
      modified = true;
      return ''; // Replace with empty string
    });

    // Save the file if it was modified
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Fixed links and removed images in ${filePath}`);
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
    console.log('Starting to remove broken links...');
    console.log(`Looking for markdown files in: ${docsDir}`);

    // Find all markdown files
    const files = findMarkdownFiles(docsDir);
    console.log(`Found ${files.length} markdown files.`);

    // Fix links in each file
    let fixedCount = 0;
    for (const file of files) {
      if (removeLinksInFile(file)) {
        fixedCount++;
      }
    }

    console.log(`Fixed links in ${fixedCount} files.`);
  } catch (error) {
    console.error('Error removing broken links:', error);
    process.exit(1);
  }
}

// Run the main function
main();
