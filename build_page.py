"""
Собирает docs/index.html — landing-страницу с draggable-кнопкой для GitHub Pages.

Запуск:
    python build_page.py

Читает set_address.bookmarklet.txt, HTML-эскейпит, подставляет в href кнопки.
Обычно запускать после build_bookmarklet.py если что-то менялось.
"""
import html
import pathlib

ROOT = pathlib.Path(__file__).parent
BM_PATH = ROOT / 'set_address.bookmarklet.txt'
OUT_PATH = ROOT / 'docs' / 'index.html'

bookmarklet = BM_PATH.read_text(encoding='utf-8').strip()
# Эскейпим для href-атрибута (двойные кавычки, амперсанды, угловые скобки)
href = html.escape(bookmarklet, quote=True)

template = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fb-billing-bookmarklet</title>
<meta name="description" content="Bookmarklet for Facebook Ads Billing Hub automation: bulk set address + attach cards + make primary.">
<style>
  :root {
    --fg: #1c1e21;
    --muted: #65676b;
    --bg: #f0f2f5;
    --card: #ffffff;
    --accent: #1877f2;
    --border: #dadde1;
    --code-bg: #0d1117;
    --code-fg: #c9d1d9;
  }
  *,*:before,*:after { box-sizing: border-box }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
  }
  .wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 22px 80px;
  }
  header { text-align: center; padding: 22px 0 14px; }
  h1 { font-size: 32px; margin: 0 0 8px; letter-spacing: -0.3px; }
  .tag { color: var(--muted); font-size: 16px; }
  .repo-link {
    display: inline-block;
    margin-top: 14px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }
  .repo-link:hover { text-decoration: underline }

  .install-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 28px;
    margin: 28px 0;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0,0,0,.05);
  }
  .install-card h2 { margin: 0 0 10px; font-size: 19px; }
  .install-hint { color: var(--muted); margin: 0 0 22px; font-size: 14px; }

  a.bm {
    display: inline-block;
    background: var(--accent);
    color: #fff !important;
    padding: 14px 28px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 700;
    font-size: 16px;
    box-shadow: 0 4px 12px rgba(24,119,242,.35);
    cursor: grab;
    user-select: none;
  }
  a.bm:active { cursor: grabbing }
  a.bm:hover { filter: brightness(1.05) }

  .steps {
    margin: 28px 0;
  }
  .steps ol {
    margin: 0;
    padding-left: 24px;
  }
  .steps li {
    margin-bottom: 10px;
  }
  code {
    background: rgba(0,0,0,.06);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: Consolas, Menlo, monospace;
    font-size: 13px;
  }
  pre {
    background: var(--code-bg);
    color: var(--code-fg);
    padding: 14px 16px;
    border-radius: 8px;
    overflow: auto;
    font-family: Consolas, Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
  }
  h2 { font-size: 20px; margin: 32px 0 10px; }
  h3 { font-size: 16px; margin: 22px 0 8px; }

  .features {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 24px;
    list-style: none;
    margin: 18px 0;
  }
  .features li { padding: 4px 0; }
  .features li::before { content: "→ "; color: var(--accent); font-weight: 700; }

  .disclaimer {
    background: #fff8e1;
    border: 1px solid #f0d878;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 28px 0;
    font-size: 14px;
    color: #5b4500;
  }

  footer {
    text-align: center;
    color: var(--muted);
    font-size: 13px;
    margin-top: 60px;
  }
  footer a { color: var(--muted) }

  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e6e9ed;
      --muted: #8a8d91;
      --bg: #18191a;
      --card: #242526;
      --border: #3a3b3c;
    }
    code { background: rgba(255,255,255,.08) }
    .disclaimer { background: #2a2410; border-color: #5b4500; color: #f0d878 }
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>fb-billing-bookmarklet</h1>
    <p class="tag">Bookmarklet для массовой автоматизации Facebook Ads Billing Hub</p>
    <a class="repo-link" href="https://github.com/AntonCocuska/fb-billing-bookmarklet">GitHub →</a>
  </header>

  <div class="install-card">
    <h2>Установка</h2>
    <p class="install-hint">Перетащи кнопку ниже в строку закладок браузера.</p>
    <a class="bm" href="__BOOKMARKLET__">FB Billing</a>
    <p class="install-hint" style="margin-top:18px">
      Не получается перетащить? Кликни правой кнопкой → <em>Добавить в закладки</em>,
      или открой <code>set_address.bookmarklet.txt</code>, скопируй содержимое и создай закладку с этим URL вручную.
    </p>
  </div>

  <h2>Что делает</h2>
  <ul class="features">
    <li><strong>Set address</strong> — массово ставит billing-адрес на список ad-аккаунтов одним GraphQL запросом (страна, штат, город, ZIP).</li>
    <li><strong>Attach card</strong> — последовательно открывает Billing Hub каждого аккаунта и автозаполняет форму карты (FB-клиент сам шифрует PAN/CVC).</li>
    <li><strong>Make primary</strong> — опционально проверяет статус только что привязанной карты и делает её основной через API.</li>
    <li>UI — плавающее окно по центру страницы в изолированном <code>iframe</code>. Ctrl+V работает, FB-перехватчики событий не мешают.</li>
    <li>Поддержка ZIP-поля и автоподстановка текущего месяца + N лет для срока.</li>
  </ul>

  <h2>Как пользоваться</h2>

  <h3>1. Set address</h3>
  <div class="steps"><ol>
    <li>Открой <code>adsmanager.facebook.com</code> или <code>business.facebook.com</code> под нужным аккаунтом.</li>
    <li>Кликни закладку — появится оверлей.</li>
    <li>Вкладка <strong>1. Set address</strong> → вставь список <code>act_ID</code> по строке → <strong>Run address</strong>.</li>
  </ol></div>
  <p>Адрес захардкожен: <code>US / DE / Wilmington / 19801</code>. Чтобы поменять — правь <code>ADDRESS</code> в <code>set_address.js</code> и пересобирай.</p>

  <h3>2. Attach card</h3>
  <div class="steps"><ol>
    <li>Лучше с <code>business.facebook.com/billing_hub/...</code> (cross-origin иначе блокирует).</li>
    <li>Вкладка <strong>2. Attach card</strong>.</li>
    <li>Имя на карте подставляется из FB-профиля. Опционально включи галку текущего месяца и поле <em>Срок (лет)</em>.</li>
    <li>Слева — список <code>act_ID</code>, справа — карты, по строкам 1:1.</li>
  </ol></div>

  <p>Формат строки карты:</p>
<pre>PAN-MM/YY-CVC     # обычный
PAN-CVC           # с галкой "подставлять текущий месяц"</pre>

  <p>Пример:</p>
<pre>4111202020206004-05/28-123
4242424242424242-12/29-456</pre>

  <h2>Технические детали</h2>
  <ul>
    <li><strong>Адрес</strong> ставится прямой GraphQL-мутацией <code>BillingAccountInformationUtilsUpdateAccountMutation</code>.</li>
    <li><strong>Карта</strong> привязывается через UI потому что PAN/CVC шифруются клиентским FB-JS (ECIES) — повторять их крипту хрупко, проще заставить их же JS сделать всё.</li>
    <li><strong>Make primary</strong> идёт через <code>BillingHubPaymentSettingsPaymentMethodsListQuery</code> (поиск карты по last4) + <code>BillingMakePrimaryStateMutation</code>.</li>
    <li>UI в <code>&lt;iframe&gt;</code> — иначе FB перехватывает Ctrl+V.</li>
    <li>React-валидация фиксится через <code>_valueTracker.setValue('')</code>.</li>
    <li>Навигация между аккаунтами — <code>location.replace()</code> + проверка что URL действительно сменился (защита от тихой привязки карты не в тот аккаунт).</li>
  </ul>

  <h2>Ограничения</h2>
  <ul>
    <li><code>doc_id</code> могут устаревать при обновлении FB UI. См. README в репо.</li>
    <li>Селекторы формы карты завязаны на <code>name=</code> атрибуты FB — могут потребовать обновления.</li>
    <li>Аккаунты должны быть доступны актору (текущему FB-пользователю).</li>
    <li>Antidetect-браузеры (AdsPower и т.п.) — разреши popup для <code>*.facebook.com</code>.</li>
  </ul>

  <div class="disclaimer">
    <strong>Disclaimer.</strong> Проект не аффилирован с Meta / Facebook. Использование автоматизации может нарушать TOS Facebook —
    ответственность на пользователе. Никаких карточных данных проект не собирает: всё работает локально в браузере,
    запросы идут только на <code>facebook.com</code>, PAN/CVC шифруются самим FB-клиентом.
    <br><br>
    JS-код в закладке имеет полный доступ к вашей facebook-сессии.
    <strong>Не вставляйте код, который не понимаете.</strong>
    Этот репо открыт для аудита — проверяйте <code>set_address.js</code> или собирайте <code>.bookmarklet.txt</code> сами из исходника.
  </div>

  <footer>
    <a href="https://github.com/AntonCocuska/fb-billing-bookmarklet">Source on GitHub</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/AntonCocuska/fb-billing-bookmarklet/blob/main/LICENSE">MIT License</a>
  </footer>

</div>
</body>
</html>
"""

OUT_PATH.parent.mkdir(exist_ok=True)
OUT_PATH.write_text(template.replace('__BOOKMARKLET__', href), encoding='utf-8')

print(f'OK: {OUT_PATH}')
print(f'   page bytes: {OUT_PATH.stat().st_size:,}')
