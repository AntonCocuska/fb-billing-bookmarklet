"""
Конвертирует .js → однострочный javascript:URL для bookmarklet.
Минифицирует мягко: убирает комменты + переносы строк + двойные пробелы.
"""
import re, sys, urllib.parse, pathlib

src_path = pathlib.Path(sys.argv[1])
src = src_path.read_text(encoding='utf-8')

# 1. Убираем /* ... */ комменты (включая многострочные)
src = re.sub(r'/\*[\s\S]*?\*/', '', src)
# 2. Убираем // комменты до конца строки (но осторожно — не трогаем url://)
src = re.sub(r'(?<![:"\'])//[^\n]*', '', src)
# 3. Схлопываем пробелы/переносы
src = re.sub(r'[\t ]*\n[\t ]*', '\n', src)
src = re.sub(r'\n+', '\n', src)
src = src.strip()

# Кодируем в javascript: URL
encoded = urllib.parse.quote(src, safe='()=>?&:,;{}[]+-*/%<>!|^~.\'"`\\')
bookmarklet = 'javascript:' + encoded

# Сохраняем рядом
out = src_path.with_suffix('.bookmarklet.txt')
out.write_text(bookmarklet, encoding='utf-8')

print(f'OK: {out}')
print(f'   raw  bytes: {len(src):,}')
print(f'   url  bytes: {len(bookmarklet):,}')
print(f'   (большинство браузеров ок до ~64KB)')
