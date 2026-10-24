import urllib.request
import json

headers = {'User-Agent': 'DefenseBudget15/1.0 (test@test.com)'}
url = 'https://en.wikipedia.org/w/api.php?action=query&titles=Type_055_destroyer&prop=pageimages&format=json&pithumbsize=640'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read().decode('utf-8'))
    pages = data.get('query', {}).get('pages', {})
    for pid, pdata in pages.items():
        if 'thumbnail' in pdata:
            img_url = pdata['thumbnail']['source']
            print('Found img_url:', img_url)
            with urllib.request.urlopen(urllib.request.Request(img_url, headers=headers)) as ir:
                with open('assets/units/T055.jpg', 'wb') as f:
                    f.write(ir.read())
            print('T055 saved successfully!')
            break
