const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'digiSchool/src/views');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace const [Grade, setForm] with const [form, setForm]
  content = content.replace(/const \[Grade, setForm\] = useState\(/g, 'const [form, setForm] = useState(');
  // Replace Grade.xxx with form.xxx if it looks like a state reference
  // Specifically: Grade.name, Grade.kcpe, etc. We can do Grade\.([a-z_A-Z]+) -> form.$1
  // But wait, there are valid "Grade" uses like "Grade 7". Those don't have a dot.
  // Wait, what about `Grade.map` or something? Valid JS variables don't start with Grade unless I wrote them.
  // Let's replace `Grade.` with `form.` ONLY if the file had `[Grade, setForm]` or similar, but simpler:
  // Just replacing `<Grade ` with `<form `, `</Grade>` with `</form>`
  content = content.replace(/<Grade /g, '<form ');
  content = content.replace(/<Grade>/g, '<form>');
  content = content.replace(/<\/Grade>/g, '</form>');

  // The Grade object fields
  content = content.replace(/Grade\./g, 'form.');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', file);
  }
});
