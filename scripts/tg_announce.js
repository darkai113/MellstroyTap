// Публикует новые объявления из RCS_Game/index.html в Telegram-канал.
// Уже опубликованные версии хранятся в scripts/tg_posted.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'RCS_Game', 'index.html');
const POSTED = path.join(__dirname, 'tg_posted.json');

const TOKEN = process.env.TG_BOT_TOKEN;
const CHAT = process.env.TG_CHAT || '@RCS_REDCARD';
if (!TOKEN) { console.error('Нет TG_BOT_TOKEN'); process.exit(1); }

function loadAnnouncements() {
  const html = fs.readFileSync(GAME, 'utf8');
  const start = html.indexOf('const ANNOUNCEMENTS = ');
  if (start < 0) throw new Error('ANNOUNCEMENTS не найден');
  const from = start + 'const ANNOUNCEMENTS = '.length;
  const end = html.indexOf('];', from);
  return new Function('return ' + html.slice(from, end + 1))();
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function api(method, body, isForm) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', body: isForm ? body : JSON.stringify(body),
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data;
}

async function main() {
  const all = loadAnnouncements();
  const posted = fs.existsSync(POSTED) ? JSON.parse(fs.readFileSync(POSTED, 'utf8')) : null;

  // Первый запуск: всё, что уже есть в игре, считаем опубликованным, чтобы не спамить старыми постами.
  if (!posted) {
    fs.writeFileSync(POSTED, JSON.stringify(all.map(a => a.version), null, 2) + '\n');
    console.log('Инициализация: ' + all.map(a => a.version).join(', ') + ' отмечены как опубликованные');
    return;
  }

  // Объявления с датой «after» не публикуем раньше этого времени
  const now = Date.now();
  const fresh = all.filter(a => !posted.includes(a.version) && (!a.after || now >= Date.parse(a.after))).reverse(); // от старых к новым
  if (!fresh.length) { console.log('Новых объявлений нет'); return; }

  for (const a of fresh) {
    const caption = `<b>${esc(a.title)}</b>\nВерсия ${esc(a.version)}\n\n${esc(a.text)}`;
    const bannerPath = path.join(ROOT, 'RCS_Game', a.banner || '');
    if (a.banner && fs.existsSync(bannerPath)) {
      const form = new FormData();
      form.append('chat_id', CHAT);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('photo', new Blob([fs.readFileSync(bannerPath)]), path.basename(bannerPath));
      await api('sendPhoto', form, true);
    } else {
      await api('sendMessage', { chat_id: CHAT, text: caption, parse_mode: 'HTML' });
    }
    posted.push(a.version);
    console.log('Опубликовано: ' + a.version);
  }
  fs.writeFileSync(POSTED, JSON.stringify(posted, null, 2) + '\n');
}

main().catch(e => { console.error(e.message); process.exit(1); });
