import json

files = ['messages/en.json', 'messages/fr.json', 'messages/ar.json']

data = {
    'Navbar': {
        'features': 'Features',
        'howItWorks': 'How it Works',
        'pricing': 'Pricing',
        'faq': 'FAQ',
        'getStarted': 'Get Started'
    },
    'Features': {
        'tagline': 'Everything you need',
        'title': 'Farm Management, Simplified.',
        'desc': 'All the tools you need to optimize your farm\'s performance, water usage, and crop yield in one place.',
        'f1Title': 'Yield Prediction Models',
        'f1Desc': 'Machine learning models trained on regional data to predict your harvest accurately.',
        'f2Title': 'Water Optimization',
        'f2Desc': 'Calculate exact crop water requirements (ETc) and reduce waste by up to 30%.',
        'f3Title': 'Drought Risk Alerts',
        'f3Desc': 'Get early warnings about moisture deficits before they cause irreversible crop damage.',
        'f4Title': 'IoT Integration',
        'f4Desc': 'Seamlessly connect with low-cost soil moisture sensors for hyper-local precision.'
    },
    'Testimonials': {
        'tagline': 'Trusted by Farmers',
        'title': 'Real Results from Moroccan Farms.',
        't1Msg': 'Soussflow completely changed how we manage irrigation. We saved 25% on our water bill in the first season alone.',
        't1Name': 'Youssef B.',
        't1Role': 'Citrus Farmer',
        't1Region': 'Taroudant',
        't2Msg': 'The yield predictions are incredibly accurate. It helped us secure better financing by proving our expected harvest value.',
        't2Name': 'Amina T.',
        't2Role': 'Tomato Cooperative Lead',
        't2Region': 'Chtouka',
        't3Msg': 'Getting alerts on WhatsApp when a sector is dry prevents us from losing crops during heatwaves. Essential tool.',
        't3Name': 'Karim M.',
        't3Role': 'Olive Grower',
        't3Region': 'Marrakech'
    },
    'Pricing': {
        'tagline': 'Pricing',
        'title': 'Simple, per-hectare pricing',
        'description': 'Stop guessing and start measuring. Every plan is designed to pay for itself in water savings alone.',
        't1Name': 'Small Farm',
        't1Desc': 'Up to 10 Hectares',
        't1Roi': 'Avg ROI: Pays for itself in 1 month of saved water',
        't1f1': 'Remote data monitoring',
        't1f2': 'Water & drought alerts',
        't1f3': 'Yield prediction',
        't1f4': 'Email support',
        't1f5': 'Basic zone mapping',
        't1Cta': 'Start Free Trial',
        't2Name': 'Commercial',
        't2Desc': 'Up to 50 Hectares',
        't2Roi': 'Avg ROI: Save +15,000 MAD/yr in irrigation costs',
        't2f1': 'Everything in Small Farm',
        't2f2': 'Hourly data & IoT updates',
        't2f3': 'Precision ETc tracking',
        't2f4': 'Automated irrigation schedules',
        't2f5': 'Priority WhatsApp support',
        't2Cta': 'Get Started',
        't3Name': 'Cooperative',
        't3Desc': '50+ Hectares',
        't3Price': 'Custom',
        't3Roi': 'Custom ROI analysis provided during consultation',
        't3f1': 'Unlimited hectares',
        't3f2': 'Custom API backend integration',
        't3f3': 'Multi-farm dashboard',
        't3f4': 'Dedicated agronomist',
        't3f5': 'On-premise hardware setup',
        't3Cta': 'Contact Sales',
        'currency': 'MAD',
        'period': '/month',
        'mostPopular': 'Most Popular'
    },
    'ImpactNumbers': {
        'title': 'Proven impact on the ground.',
        'description': 'Metrics recorded across our network of Moroccan partner farms during the previous harvest season.',
        'lessWaterWaste': 'Less Water Waste',
        'earlierDroughtDetection': 'Earlier Drought Detection',
        'yieldImprovement': 'Yield Improvement',
        'hectaresMonitored': 'Hectares Monitored',
        'wksSuffix': ' wks'
    },
    'FAQ': {
        'tagline': 'FAQ',
        'title': 'Frequently asked questions',
        'q1': 'How accurate are the yield predictions?',
        'a1': 'Our model has been trained specifically on the last 10 years of Moroccan climate data... It achieves ~94% accuracy forecasting yields up to 30 days before harvest.',
        'q2': 'Does soussflow work for olives and citrus?',
        'a2': 'Yes, our core models are specifically optimized for Moroccan staple crops...',
        'q3': 'Do I need sensors placed all over my farm?',
        'a3': 'No. Our hybrid model uses high-resolution imaging combined with strategic placement of just 1-2 low-cost IoT soil sensors per major zone...',
        'q4': 'How often is the monitoring data updated?',
        'a4': 'We utilize remote imaging data which sweeps the region every 2-5 days. For Commercial plans, we combine this with daily weather micro-climate updates...',
        'q5': 'Is the platform available in Darija or French for my farm workers?',
        'a5': 'Yes! The mobile app used by farm operators is fully localized in French, Arabic, and Darija...'
    },
    'Footer': {
        'tagline': 'Empowering Moroccan agriculture with smart data intelligence and localized AI to combat the structural water crisis.',
        'product': 'Product',
        'p1': 'Remote Monitoring',
        'p2': 'Yield Prediction',
        'p3': 'Smart Alerts',
        'p4': 'Pricing',
        'company': 'Company',
        'c1': 'About Us',
        'c2': 'Careers',
        'c3': 'Partner Network',
        'c4': 'Contact',
        'newsletterTitle': 'Agri-Insights Newsletter',
        'newsletterDesc': 'Get monthly updates on Moroccan water policy and yield optimization strategies.',
        'emailPlaceholder': 'Enter your email',
        'terms': 'Terms',
        'privacy': 'Privacy'
    },
    'CTA': {
        'title': 'Stop wasting water.<br className=\"hidden md:block\" /> Start farming with data.',
        'description': 'Join hundreds of Moroccan farmers taking control of their water usage.',
        'startTrial': 'Start Free Trial',
        'seeDemo': 'See Demo',
        'disclaimer': 'Zero commitment. 14-day tracking test on your own fields.'
    },
    'CrisisTicker': {
        't1': 'Al Massira Dam at 5.4% capacity',
        't2': '70% of Moroccos drought levels reached a critical stage',
        't3': 'Morocco sets limit on water usage for agriculture',
        't4': 'Souss-Massa region groundwater depleted by 1.5m per year',
        't5': 'Desalination project in Casablanca fast-tracked for 2026'
    }
}

data_fr = {
    'Navbar': {
        'features': 'Fonctionnalités',
        'howItWorks': 'Comment ça marche',
        'pricing': 'Tarifs',
        'faq': 'FAQ',
        'getStarted': 'Commencer'
    },
    'Features': {
        'tagline': 'Tout ce dont vous avez besoin',
        'title': 'La gestion agricole, simplifiée.',
        'desc': 'Tous les outils nécessaires pour optimiser les performances de votre ferme, l\'utilisation de l\'eau et le rendement des cultures en un seul endroit.',
        'f1Title': 'Modèles de Prédiction de Rendement',
        'f1Desc': 'Modèles d\'apprentissage automatique formés sur des données régionales pour prédire votre récolte avec précision.',
        'f2Title': 'Optimisation de l\'Eau',
        'f2Desc': 'Calculez les besoins exacts en eau des cultures (ETc) et réduisez le gaspillage jusqu\'à 30%.',
        'f3Title': 'Alertes de Risque de Sécheresse',
        'f3Desc': 'Recevez des alertes précoces sur les déficits d\'humidité avant qu\'ils ne causent des dommages irréversibles aux cultures.',
        'f4Title': 'Intégration IoT',
        'f4Desc': 'Connectez-vous facilement avec des capteurs d\'humidité du sol à faible coût pour une précision hyper-locale.'
    },
    'Testimonials': {
        'tagline': 'La confiance des agriculteurs',
        'title': 'Résultats réels des fermes marocaines.',
        't1Msg': 'Soussflow a complètement changé notre façon de gérer l\'irrigation. Nous avons économisé 25% sur notre facture d\'eau dès la première saison.',
        't1Name': 'Youssef B.',
        't1Role': 'Producteur d\'agrumes',
        't1Region': 'Taroudant',
        't2Msg': 'Les prévisions de rendement sont incroyablement précises. Cela nous a aidés à obtenir un meilleur financement.',
        't2Name': 'Amina T.',
        't2Role': 'Chef de coopérative de tomates',
        't2Region': 'Chtouka',
        't3Msg': 'Recevoir des alertes sur WhatsApp lorsqu\'un secteur est sec nous évite de perdre des récoltes. Outil essentiel.',
        't3Name': 'Karim M.',
        't3Role': 'Cultivateur d\'olives',
        't3Region': 'Marrakech'
    },
    'Pricing': {
        'tagline': 'Tarifs',
        'title': 'Une tarification simple, par hectare',
        'description': 'Arrêtez de deviner et commencez à mesurer. Chaque plan est conçu pour s\'amortir de lui-même.',
        't1Name': 'Petite Ferme',
        't1Desc': 'Jusqu\'à 10 Hectares',
        't1Roi': 'ROI Moyen: S\'amortit en 1 mois d\'eau économisée',
        't1f1': 'Surveillance des données à distance',
        't1f2': 'Alertes eau et sécheresse',
        't1f3': 'Prédiction de rendement',
        't1f4': 'Support par e-mail',
        't1f5': 'Cartographie de base',
        't1Cta': 'Essai Gratuit',
        't2Name': 'Commercial',
        't2Desc': 'Jusqu\'à 50 Hectares',
        't2Roi': 'ROI Moyen: Économisez +15 000 MAD/an',
        't2f1': 'Tout ce qui est dans Petite Ferme',
        't2f2': 'Mises à jour horaires IoT',
        't2f3': 'Suivi de précision ETc',
        't2f4': 'Programmes d\'irrigation automatisés',
        't2f5': 'Support prioritaire WhatsApp',
        't2Cta': 'Commencer',
        't3Name': 'Coopérative',
        't3Desc': '50+ Hectares',
        't3Price': 'Sur Mesure',
        't3Roi': 'Analyse ROI personnalisée lors de la consultation',
        't3f1': 'Hectares illimités',
        't3f2': 'Intégration API personnalisée',
        't3f3': 'Tableau de bord multi-fermes',
        't3f4': 'Agronome dédié',
        't3f5': 'Configuration du matériel sur site',
        't3Cta': 'Contacter les Ventes',
        'currency': 'MAD',
        'period': '/mois',
        'mostPopular': 'Le Plus Populaire'
    },
    'ImpactNumbers': {
        'title': 'Un impact prouvé sur le terrain.',
        'description': 'Métriques enregistrées à travers notre réseau de fermes partenaires marocaines lors de la campagne précédente.',
        'lessWaterWaste': 'Moins de Gaspillage D\'eau',
        'earlierDroughtDetection': 'Détection Plus Précoce',
        'yieldImprovement': 'Amélioration du Rendement',
        'hectaresMonitored': 'Hectares Surveillés',
        'wksSuffix': ' sem'
    },
    'FAQ': {
        'tagline': 'FAQ',
        'title': 'Questions fréquemment posées',
        'q1': 'Quelle est la précision des prévisions de rendement ?',
        'a1': 'Notre modèle a été formé spécifiquement sur les 10 dernières années de données climatiques marocaines...',
        'q2': 'Soussflow fonctionne-t-il pour les olives et les agrumes ?',
        'a2': 'Oui, nos modèles de base sont spécifiquement optimisés pour les cultures de base marocaines...',
        'q3': 'Dois-je placer des capteurs partout dans ma ferme ?',
        'a3': 'Non. Notre modèle hybride utilise une imagerie haute résolution combinée au placement stratégique de 1 ou 2 capteurs IoT...',
        'q4': 'À quelle fréquence les données de surveillance sont-elles mises à jour ?',
        'a4': 'Nous utilisons des données d\'imagerie qui balaient la région tous les 2 à 5 jours...',
        'q5': 'La plateforme est-elle disponible en darija ou en français pour mes travailleurs agricoles ?',
        'a5': 'Oui ! L\'application mobile utilisée par les opérateurs agricoles est entièrement localisée en français, en arabe et en darija...'
    },
    'Footer': {
        'tagline': 'Autonomiser l\'agriculture marocaine avec l\'intelligence des données et l\'IA localisée pour lutter contre la crise structurelle de l\'eau.',
        'product': 'Produit',
        'p1': 'Surveillance à Distance',
        'p2': 'Prédiction de Rendement',
        'p3': 'Alertes Intelligentes',
        'p4': 'Tarifs',
        'company': 'Entreprise',
        'c1': 'À Propos',
        'c2': 'Carrières',
        'c3': 'Réseau de Partenaires',
        'c4': 'Contact',
        'newsletterTitle': 'Newsletter Agri-Insights',
        'newsletterDesc': 'Recevez des mises à jour mensuelles sur la politique de l\'eau marocaine et les stratégies d\'optimisation.',
        'emailPlaceholder': 'Entrez votre e-mail',
        'terms': 'Conditions',
        'privacy': 'Confidentialité'
    },
    'CTA': {
        'title': 'Arrêtez de gaspiller l\'eau.<br className=\"hidden md:block\" /> Commencez à cultiver avec des données.',
        'description': 'Rejoignez des centaines d\'agriculteurs marocains qui prennent le contrôle de leur utilisation de l\'eau.',
        'startTrial': 'Commencer l\'Essai Gratuit',
        'seeDemo': 'Voir la démo',
        'disclaimer': 'Zéro engagement. Test de suivi de 14 jours sur vos propres champs.'
    },
    'CrisisTicker': {
        't1': 'Barrage Al Massira à 5,4% de capacité',
        't2': '70 % de la sécheresse au Maroc a atteint un stade critique',
        't3': 'Le Maroc fixe une limite sur l\'utilisation de l\'eau',
        't4': 'Nappe phréatique du Souss-Massa épuisée de 1,5m/an',
        't5': 'Projet de dessalement à Casablanca accéléré pour 2026'
    }
}

data_ar = {
    'Navbar': {
        'features': 'المميزات',
        'howItWorks': 'كيف نعمل',
        'pricing': 'الأسعار',
        'faq': 'الأسئلة الشائعة',
        'getStarted': 'ابدأ الآن'
    },
    'Features': {
        'tagline': 'كل ما تحتاجه',
        'title': 'إدارة المزرعة، مبسطة.',
        'desc': 'جميع الأدوات التي تحتاجها لتحسين أداء مزرعتك، استخدام المياه، وإنتاجية المحاصيل في مكان واحد.',
        'f1Title': 'نماذج التنبؤ بالإنتاجية',
        'f1Desc': 'نماذج تعلم آلي مدربة على البيانات الإقليمية للتنبؤ بالمحصول بدقة.',
        'f2Title': 'تحسين المياه',
        'f2Desc': 'احسب متطلبات المياه الدقيقة للمحصول (ETc) وقلل الهدر بنسبة تصل إلى 30٪.',
        'f3Title': 'إنذارات خطر الجفاف',
        'f3Desc': 'احصل على إنذارات مبكرة حول نقص الرطوبة قبل أن تتسبب في أضرار لا رجعة فيها للمحاصيل.',
        'f4Title': 'تكامل إنترنت الأشياء (IoT)',
        'f4Desc': 'توصيل سلس مع مستشعرات رطوبة التربة منخفضة التكلفة بدقة شديدة.'
    },
    'Testimonials': {
        'tagline': 'موثوق من قبل المزارعين',
        'title': 'نتائج حقيقية من مزارع مغربية.',
        't1Msg': 'سوس فلو غيّر تماماً طريقة إدارتنا للري. وفرنا 25٪ في فاتورة المياه في الموسم الأول فقط.',
        't1Name': 'يوسف ب.',
        't1Role': 'مزارع حمضيات',
        't1Region': 'تارودانت',
        't2Msg': 'التوقعات دقيقة بشكل لا يصدق. ساعدتنا في تأمين تمويل أفضل من خلال إثبات قيمة محصولنا المتوقع.',
        't2Name': 'أمينة ت.',
        't2Role': 'مديرة تعاونية الطماطم',
        't2Region': 'شتوكة',
        't3Msg': 'تلقي إنذارات على واتساب عندما يكون القطاع جافاً يمنعنا من خسارة المحاصيل أثناء موجات الحر.',
        't3Name': 'كريم م.',
        't3Role': 'مزارع زيتون',
        't3Region': 'مراكش'
    },
    'Pricing': {
        'tagline': 'الأسعار',
        'title': 'أسعار بسيطة، حسب الهكتار',
        'description': 'توقف عن التخمين وابدأ في القياس. تم تصميم كل خطة لتدفع ثمنها من توفير المياه.',
        't1Name': 'مزرعة صغيرة',
        't1Desc': 'حتى 10 هكتار',
        't1Roi': 'متوسط العائد: تسترد قيمتها في شهر واحد من توفير المياه',
        't1f1': 'مراقبة البيانات عن بعد',
        't1f2': 'إنذارات المياه والجفاف',
        't1f3': 'توقع الإنتاجية',
        't1f4': 'دعم عبر البريد الإلكتروني',
        't1f5': 'رسم خرائط القطاعات',
        't1Cta': 'ابدأ الآن مجاناً',
        't2Name': 'تجاري',
        't2Desc': 'حتى 50 هكتار',
        't2Roi': 'متوسط العائد: توفير +15000 درهم/سنة في تكاليف الري',
        't2f1': 'كل ما في باقة مزرعة صغيرة',
        't2f2': 'تحديثات بيانات كل ساعة',
        't2f3': 'تتبع دقيق لـ ETc',
        't2f4': 'جدولة ري آلي',
        't2f5': 'دعم أولوية على واتساب',
        't2Cta': 'ابدأ الآن',
        't3Name': 'تعاونية',
        't3Desc': 'أكثر من 50 هكتار',
        't3Price': 'مخصص',
        't3Roi': 'تحليل خاص للعائد يتم تقديمه خلال الاستشارة',
        't3f1': 'هكتارات غير محدودة',
        't3f2': 'تكامل API مخصص',
        't3f3': 'لوحة تحكم متعددة المزارع',
        't3f4': 'مهندس زراعي مخصص',
        't3f5': 'إعداد الأجهزة محلياً',
        't3Cta': 'تواصل مع المبيعات',
        'currency': 'درهم',
        'period': '/شهر',
        'mostPopular': 'الأكثر شعبية'
    },
    'ImpactNumbers': {
        'title': 'أثر مثبت على أرض الواقع.',
        'description': 'مقاييس تم تسجيلها عبر شبكتنا من المزارع الشريكة في المغرب خلال موسم الحصاد الماضي.',
        'lessWaterWaste': 'أقل هدر للمياه',
        'earlierDroughtDetection': 'اكتشاف مبكر للجفاف',
        'yieldImprovement': 'تحسن في العائد',
        'hectaresMonitored': 'هكتار تحت المراقبة',
        'wksSuffix': ' أسبوع'
    },
    'FAQ': {
        'tagline': 'الأسئلة الشائعة',
        'title': 'أسئلة يتكرر طرحها',
        'q1': 'ما مدى دقة توقعات الإنتاجية؟',
        'a1': 'تم تدريب نموذجنا بشكل خاص على مدار العقد الماضي من بيانات المناخ المغربية... ويصل لدقة 94٪.',
        'q2': 'هل تعمل المنصة للمحاصيل الزراعية مثل الزيتون؟',
        'a2': 'نعم، نماذجنا الأساسية محسّنة لكل المحاصيل المغربية...',
        'q3': 'هل أحتاج إلى وضع أجهزة استشعار في كل مكان في مزرعتي؟',
        'a3': 'لا. يستخدم نموذجنا الهجين صورًا عالية الدقة مقترنة بوضع مستشعر واحد أو اثنين بذكاء.',
        'q4': 'كم مرة يتم تحديث بيانات المراقبة؟',
        'a4': 'يتم تحديث صور الاستشعار عن بعد كل 2 إلى 5 أيام. ويتم إضافة بيانات الطقس يوميًا.',
        'q5': 'هل تتوفر المنصة بالدارجة أو الفرنسية لعمال مزرعتي؟',
        'a5': 'نعم! يتوفر التطبيق باللغات الفرنسية والعربية والدارجة.'
    },
    'Footer': {
        'tagline': 'تمكين الزراعة في المغرب بالذكاء الاصطناعي لمكافحة أزمة المياه.',
        'product': 'المنتج',
        'p1': 'مراقبة عن بعد',
        'p2': 'توقع الإنتاجية',
        'p3': 'إنذارات ذكية',
        'p4': 'الأسعار',
        'company': 'الشركة',
        'c1': 'معلومات عنا',
        'c2': 'الوظائف',
        'c3': 'شبكة الشركاء',
        'c4': 'تواصل معنا',
        'newsletterTitle': 'نشرة الأخبار الزراعية',
        'newsletterDesc': 'احصل على تحديثات شهرية حول استراتيجيات توفير المياه في المغرب.',
        'emailPlaceholder': 'أدخل بريدك الإلكتروني',
        'terms': 'الشروط',
        'privacy': 'الخصوصية'
    },
    'CTA': {
        'title': 'توقف عن هدر المياه.<br className=\"hidden md:block\" /> ابدأ الزراعة بالبيانات.',
        'description': 'انضم إلى مئات المزارعين في المغرب للتحكم في استهلاك المياه.',
        'startTrial': 'ابدأ الآن',
        'seeDemo': 'مشاهدة العرض',
        'disclaimer': '14 يوماً من التجارب المجانية على مزرعتك.'
    },
    'CrisisTicker': {
        't1': 'سد المسيرة عند سعة 5.4٪',
        't2': '70٪ من مستويات الجفاف في المغرب وصلت إلى مرحلة حرجة',
        't3': 'المغرب يحدد الحد الأقصى لاستهلاك المياه للزراعة',
        't4': 'استنزاف المياه الجوفية بجهة سوس ماسة بمقدار 1.5 م / سنة',
        't5': 'تسريع مشروع تحلية المياه بالدار البيضاء لعام 2026'
    }
}

for filepath, new_data in zip(files, [data, data_fr, data_ar]):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = json.load(f)
    
    for key, value in new_data.items():
        if key not in content:
            content[key] = value
        else:
            for nested_k, nested_v in value.items():
                content[key][nested_k] = nested_v
                
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(content, f, indent=4, ensure_ascii=False)
