import json

files = ['messages/en.json', 'messages/fr.json', 'messages/ar.json']

data = {
    'Navbar': {
        'home': 'Home',
        'product': 'Product',
        'caseStudies': 'Case Studies',
        'about': 'About',
        'howItWorks': 'How it Works',
        'pricing': 'Pricing',
        'getStarted': 'Get Started'
    }
}

data_fr = {
    'Navbar': {
        'home': 'Accueil',
        'product': 'Produit',
        'caseStudies': 'Études de Cas',
        'about': 'À Propos',
        'howItWorks': 'Comment ça marche',
        'pricing': 'Tarifs',
        'getStarted': 'Commencer'
    }
}

data_ar = {
    'Navbar': {
        'home': 'الرئيسية',
        'product': 'المنتج',
        'caseStudies': 'دراسات الحالة',
        'about': 'معلومات عنا',
        'howItWorks': 'كيف نعمل',
        'pricing': 'الأسعار',
        'getStarted': 'ابدأ الآن'
    }
}

for filepath, update_data in zip(files, [data, data_fr, data_ar]):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = json.load(f)
    
    if 'Navbar' not in content:
        content['Navbar'] = {}
        
    for k, v in update_data['Navbar'].items():
        content['Navbar'][k] = v
        
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(content, f, indent=4, ensure_ascii=False)
