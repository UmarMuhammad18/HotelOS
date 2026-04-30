import os

target = 'c:/Users/oumar/HotelOS/src'
for root, dirs, files in os.walk(target):
    for f in files:
        if f.endswith('.jsx'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            
            if "process.env.REACT_APP_API_URL || ''" in content:
                rel = os.path.relpath('c:/Users/oumar/HotelOS/src/config.js', os.path.dirname(filepath)).replace('\\', '/')
                if not rel.startswith('.'):
                    rel = './' + rel
                rel = rel.replace('.js', '')
                
                parts = content.split('\n')
                if 'import { API_BASE }' not in content:
                    for i, line in enumerate(parts):
                        if not line.startswith('import '):
                            parts.insert(i, f"import {{ API_BASE }} from '{rel}';")
                            break
                
                new_content = '\n'.join(parts).replace("`${process.env.REACT_APP_API_URL || ''}", "`${API_BASE}")
                with open(filepath, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print('Updated', filepath)
