// 원작 소스에 i18n 훅을 넣는다. 웹 편집기 대신 러너에서 실행(문자열 치환, 실패 시 중단).
import { readFileSync, writeFileSync } from 'node:fs';

const patches = [
  ['src/main.js', "import { contentReady } from './data/content/index.js';",
   "import { contentReady } from './data/content/index.js';\nimport { installI18n } from './i18n/dom.js';\nimport { localizeData } from './i18n/data.js';"],
  ['src/main.js', 'window.afterlight = game; // handy for debugging in the console',
   'installI18n(); // 한국어 오버레이(DOM 텍스트)와 언어 토글 버튼\nwindow.afterlight = game; // handy for debugging in the console'],
  ['src/main.js', '  await contentReady; // all chapter packs registered',
   '  await contentReady; // all chapter packs registered\n  localizeData(); // 아이템·스킬·적·크레스트 이름/설명 번역'],
  ['src/ui/UI.js', "import { keyCap } from '../core/Input.js';",
   "import { keyCap } from '../core/Input.js';\nimport { t as tr } from '../i18n/index.js';"],
  ['src/ui/UI.js', '  dialogue(speaker, text, opts = {}) {',
   '  dialogue(speaker, text, opts = {}) {\n    speaker = tr(speaker); text = tr(text);'],
  ['src/script/ScriptContext.js', "import { playLines, testCond } from './Lines.js';",
   "import { playLines, testCond } from './Lines.js';\nimport { t, fmt } from '../i18n/index.js';"],
  ['src/script/ScriptContext.js', '    const st = this.state;\n    return String(text)',
   '    const st = this.state;\n    return t(String(text))'],
  ['src/script/ScriptContext.js', 'await this.ui.message(`Obtained *${this.state.inventory.itemName(itemId)}*${count > 1 ? ` ×${count}` : \'\'}.`);',
   'await this.ui.message(fmt(\'Obtained *{0}*{1}.\', this.state.inventory.itemName(itemId), count > 1 ? ` ×${count}` : \'\'));'],
  ['src/script/ScriptContext.js', 'await this.ui.message(`Received *${amount}* gold.`);',
   'await this.ui.message(fmt(\'Received *{0}* gold.\', amount));'],
  ['src/script/ScriptContext.js', 'await this.ui.message(`*${this.state.characters[charId].name}* joined the party!`);',
   'await this.ui.message(fmt(\'*{0}* joined the party!\', this.state.characters[charId].name));'],
  ['src/script/ScriptContext.js', 'await this.ui.message(`New Crest available: *${this.state.crestName(crestId)}*`);',
   'await this.ui.message(fmt(\'New Crest available: *{0}*\', this.state.crestName(crestId)));'],
  ['index.html', '  <link rel="stylesheet" href="css/style.css">',
   '  <link rel="stylesheet" href="css/style.css">\n  <link rel="stylesheet" href="css/ko.css">'],
];

let changed = 0;
for (const [file, find, repl] of patches) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(find)) { console.log('MISS ' + file + ' :: ' + find.slice(0, 60)); continue; }
  writeFileSync(file, src.replace(find, repl));
  changed++;
}
console.log('patched ' + changed + '/' + patches.length);
if (changed !== patches.length) process.exit(1);
