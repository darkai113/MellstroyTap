// Google Apps Script: принимает жалобы из игры и пересылает их в группу через бота.
//
// Настройка (один раз):
// 1. script.google.com → Новый проект → вставить этот код вместо всего, что там было.
// 2. Настройки проекта (шестерёнка) → Свойства скрипта → добавить:
//      BOT_TOKEN       = токен от @BotFather
//      REPORT_CHAT_ID  = id группы (отрицательное число, вида -100...)
// 3. Развернуть → Новое развертывание → Тип: Веб-приложение
//      Кто имеет доступ: Все. Нажать «Развернуть», скопировать адрес, который заканчивается на /exec
// 4. Этот адрес вставить в RCS_Game/index.html в константу REPORT_URL.

const MAX_TEXT = 700;

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('BOT_TOKEN');
    const chatId = props.getProperty('REPORT_CHAT_ID');
    if (!token || !chatId) return ok('not configured');

    const data = JSON.parse(e.postData.contents || '{}');
    const text = String(data.text || '').slice(0, MAX_TEXT);
    if (text.length < 5) return ok('too short');

    const header = '🐞 Помощь из игры\n'
      + 'Версия: ' + (data.version || '?') + '\n'
      + 'Экран: ' + (data.screen || '?') + '\n'
      + 'Время: ' + (data.ts || '?') + '\n'
      + 'Устройство: ' + (data.ua || '?') + '\n\n';
    const message = header + text;
    const api = 'https://api.telegram.org/bot' + token + '/';

    const image = String(data.image || '');
    const m = image.match(/^data:image\/jpeg;base64,(.+)$/);
    if (m) {
      const bytes = Utilities.base64Decode(m[1]);
      const blob = Utilities.newBlob(bytes, 'image/jpeg', 'screenshot.jpg');
      // Подпись к фото до 1024 символов, поэтому текст обрезается
      UrlFetchApp.fetch(api + 'sendPhoto', {
        method: 'post',
        payload: { chat_id: chatId, caption: message.slice(0, 1000), photo: blob },
        muteHttpExceptions: true
      });
    } else {
      UrlFetchApp.fetch(api + 'sendMessage', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: message }),
        muteHttpExceptions: true
      });
    }
    return ok('sent');
  } catch (err) {
    return ok('error');
  }
}

function ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, msg: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Проверка из редактора: отправит тестовое сообщение в группу
function testSend() {
  const props = PropertiesService.getScriptProperties();
  UrlFetchApp.fetch('https://api.telegram.org/bot' + props.getProperty('BOT_TOKEN') + '/sendMessage', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ chat_id: props.getProperty('REPORT_CHAT_ID'), text: 'Тест: бот помощи подключён' }),
    muteHttpExceptions: true
  });
}
