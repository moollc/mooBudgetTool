var fs = require('fs');
var content = fs.readFileSync('_syntax_check.js', 'utf8');
var lines = content.split('\n');

// Binary search for the first line that causes a parse error
function testUpTo(n) {
  var chunk = lines.slice(0, n).join('\n');
  // Add enough closing braces/parens to close any open structures
  chunk += '\n' + '}'.repeat(50) + ')'.repeat(50);
  try {
    new Function(chunk);
    return true;
  } catch(e) {
    // Check if the error is about our added closing chars or about actual content
    return false;
  }
}

// First find if the whole thing fails even with closing
try {
  new Function(content);
  console.log('SYNTAX: PASS - no errors found');
  process.exit(0);
} catch(e) {
  console.log('Confirmed error:', e.message);
}

// Search line by line from the end backwards
// Find what line, when removed, fixes things
var lo = 0, hi = lines.length;
while (hi - lo > 1) {
  var mid = Math.floor((lo + hi) / 2);
  if (testUpTo(mid)) {
    lo = mid;
  } else {
    hi = mid;
  }
}

console.log('First problematic line (extracted):', hi);
console.log('Corresponding index.html line:', hi + 370);
console.log('');
for (var i = Math.max(0, hi - 5); i < Math.min(lines.length, hi + 5); i++) {
  var marker = (i === hi - 1) ? ' >>> ' : '     ';
  console.log(marker + (i + 1) + ' (L' + (i+371) + '): ' + lines[i].substring(0, 140));
}
