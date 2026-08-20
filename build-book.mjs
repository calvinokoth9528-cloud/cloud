import { readFileSync, writeFileSync } from 'node:fs'
import { marked } from 'marked'

const md = readFileSync(new URL('./BOOK.md', import.meta.url), 'utf8')
let html = await marked.parse(md)

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const seen = new Map()
html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
  let slug = slugify(inner)
  const count = seen.get(slug) || 0
  seen.set(slug, count + 1)
  if (count > 0) slug = `${slug}-${count}`
  return `<h${level} id="${slug}">${inner}</h${level}>`
})

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The Forecast Dashboard Book — Calvin Okoth</title>
<style>
  :root { --ink:#1c2430; --muted:#5b647a; --line:#e3e7ef; --accent:#4f8cff; --bg:#f7f8fb; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family: Georgia, 'Times New Roman', serif; line-height:1.65; }
  .page { max-width: 820px; margin: 0 auto; padding: 56px 32px 96px; }
  h1,h2,h3,h4 { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height:1.25; scroll-margin-top:24px; }
  h1 { font-size: 2.1rem; margin-top:0; }
  h2 { font-size: 1.5rem; margin-top: 2.4rem; padding-bottom:.3rem; border-bottom:1px solid var(--line); }
  h3 { font-size: 1.2rem; margin-top:1.8rem; }
  p { margin: 1rem 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    background:#eef1f7; padding:.12em .4em; border-radius:4px; font-size:.9em; }
  pre { background:#0e1117; color:#e6e9f0; padding:16px; border-radius:10px; overflow:auto; }
  pre code { background:transparent; color:inherit; padding:0; }
  table { border-collapse: collapse; width:100%; margin:1.2rem 0; font-size:.95rem;
    font-family: system-ui, sans-serif; }
  th, td { border:1px solid var(--line); padding:8px 10px; text-align:left; }
  th { background:#eef1f7; }
  ul, ol { padding-left: 1.4rem; }
  li { margin:.35rem 0; }
  hr { border:none; border-top:1px solid var(--line); margin:2.4rem 0; }
  .cover { text-align:center; padding:48px 0 32px; border-bottom:2px solid var(--ink); margin-bottom:8px; }
  .cover .sub { color:var(--muted); font-style:italic; font-size:1.1rem; }
  .cover .meta { margin-top:18px; font-family: system-ui, sans-serif; color:var(--muted); font-size:.95rem; }
  .cover .author { font-weight:700; color:var(--ink); font-size:1.15rem; }
  blockquote { border-left:3px solid var(--accent); margin:1.2rem 0; padding:.2rem 1rem; color:var(--muted); }
  .tip { background:#eef1f7; border-left:3px solid var(--accent); padding:.8rem 1rem; border-radius:6px; }
</style>
</head>
<body>
  <div class="page">
${html}
  </div>
</body>
</html>
`

writeFileSync(new URL('./book.html', import.meta.url), page, 'utf8')
console.log('book.html written:', page.length, 'bytes')
