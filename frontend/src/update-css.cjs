const fs = require('fs');
let css = fs.readFileSync('index.css', 'utf-8');

// 1. Update variables in :root
css = css.replace(/--color-surface-base: #ffffff;/, '--color-surface-base: #000000;');

// 2. Replace all instances of var(--color-surface-base) with var(--color-surface-muted) globally
css = css.replace(/var\(--color-surface-base\)/g, 'var(--color-surface-muted)');

// 3. Fix the :root definition we accidentally replaced in step 2
css = css.replace(/--color-surface-muted: #000000;/, '--color-surface-base: #000000;');

// 4. Update Sidebar text color since it uses surface-strong which is light
css = css.replace(/\.sidebar-logo \{\s*([\s\S]*?)\s*\}/, (match, body) => {
  return `.sidebar-logo {\n${body.replace(/color: var\(--color-text-primary\);/, 'color: var(--color-surface-base); /* Inverse */')}\n}`;
});
css = css.replace(/\.nav-btn:hover \{\s*([\s\S]*?)\s*\}/, (match, body) => {
  return `.nav-btn:hover {\n${body.replace(/color: var\(--color-text-primary\);/, 'color: var(--color-surface-base);')}\n}`;
});
css = css.replace(/\.nav-btn\.active \{\s*([\s\S]*?)\s*\}/, (match, body) => {
  return `.nav-btn.active {\n${body.replace(/color: var\(--color-text-primary\);/, 'color: var(--color-surface-base);')}\n}`;
});

// 5. User badge text inverse
css = css.replace(/\.user-badge \{\s*([\s\S]*?)\s*\}/, (match, body) => {
  if (!body.includes('color:')) {
    return `.user-badge {\n${body}\n  color: var(--color-text-inverse);\n}`;
  }
  return match;
});

// 6. Append Button Overrides safely
const overrides = `
/* ── Tavily Strict Overrides ── */
.btn-primary {
  background: var(--color-surface-base) !important;
  color: #ffffff !important;
  border: 1px solid var(--color-surface-base) !important;
  transition: all var(--motion-fast);
}
.btn-primary:hover {
  background: #1a1a1a !important;
  border-color: #1a1a1a !important;
}
.btn-primary:focus-visible {
  outline: 2px solid var(--color-surface-strong) !important;
  outline-offset: 2px !important;
}
.btn-primary:active {
  transform: scale(0.98) !important;
}
.btn-primary:disabled, .btn-primary.loading {
  background: var(--color-border-default) !important;
  border-color: var(--color-border-default) !important;
  color: var(--color-text-inverse) !important;
  cursor: not-allowed !important;
  transform: none !important;
}

.btn-secondary {
  background: transparent !important;
  color: var(--color-text-primary) !important;
  border: 1px solid var(--color-border-default) !important;
}
.btn-secondary:hover {
  background: var(--color-border-default) !important;
}
.btn-secondary:focus-visible {
  outline: 2px solid var(--color-surface-strong) !important;
  outline-offset: 2px !important;
}
.btn-secondary:active {
  transform: scale(0.98) !important;
}
.btn-secondary:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
}
`;

css += overrides;

fs.writeFileSync('index.css', css, 'utf-8');
console.log('CSS perfectly updated!');
