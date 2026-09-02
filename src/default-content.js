export const DEFAULT_THEME = {
  colors: {
    navy: '#0a1628',
    navyLight: '#152238',
    navyMedium: '#1a2d4a',
    brass: '#c9a84c',
    brassLight: '#dfc06a',
    brassDark: '#a8872e',
    copper: '#b87333',
    offWhite: '#f8f6f1',
    grayLight: '#e8e4dc',
    gray: '#9a9590',
  },
  fonts: {
    heading: 'Playfair Display',
    body: 'Montserrat',
  },
};

export const DEFAULT_ANIMATIONS = {
  hero: { preset: 'fadeIn', duration: 0.8, delay: 0.2, stagger: 0.15, enabled: true },
  about: { preset: 'slideUp', duration: 0.6, delay: 0, stagger: 0.1, enabled: true },
  philosophy: { preset: 'slideUp', duration: 0.6, delay: 0, stagger: 0.1, enabled: true },
  gallery: { preset: 'scaleIn', duration: 0.5, delay: 0, stagger: 0.08, enabled: true },
  cta: { preset: 'fadeIn', duration: 0.7, delay: 0, stagger: 0, enabled: true },
  contact: { preset: 'slideUp', duration: 0.6, delay: 0, stagger: 0.1, enabled: true },
  footer: { preset: 'fadeIn', duration: 0.5, delay: 0, stagger: 0, enabled: true },
};

export const DEFAULT_CONTENT = {
  siteConfig: {
    companyName: 'D&D HOMEINVEST',
    companyFullName: 'D&D HOMEINVEST s.r.o.',
    tagline: 'Rodinné projekty s tradicí a stylem',
    phone: '+420725591623',
    email: 'info@ddhomeinvest.cz',
    address: 'Mažice 61, Jižní Čechy',
    ico: '29483638',
    tradeRegister:
      'Společnost je zapsaná v obchodním rejstříku vedeném Krajským soudem v Českých Budějovicích, oddíl C, vložka 36554',
    formspreeId: 'mrerbaqr',
  },
  heroContent: {
    title: 'HOMEINVEST',
    subtitle: 'Rodinné projekty s tradicí a stylem',
    description:
      'Vracíme život starým bytům. Dáváme jim nový standard, moderní styl a skutečnou duši.',
    ctaText: 'Naše projekty',
    ctaLink: '#galerie',
    secondaryCtaText: 'Kontaktujte nás',
    secondaryCtaLink: '#kontakt',
  },
  aboutContent: {
    sectionTitle: 'O nás',
    sectionSubtitle: 'Spojení poctivého řemesla a moderního bydlení',
    intro:
      'Značka D&D HOMEINVEST nevznikla přes noc. Je to přirozený vrchol naší rodinné cesty ve stavebnictví. Uvědomili jsme si, že chceme nejen stavět a rekonstruovat, ale tvořit vlastní kompletní domovy od A do Z – bez kompromisů a přesně podle našich nejvyšších standardů. Proto jsme založili D&D HOMEINVEST jako rodinnou značku. Ta se může plně opřít o silné základy naší realizační firmy <a href="https://vdstavby.cz" target="_blank" rel="noopener noreferrer" class="text-brass hover:text-brass-dark underline">VDStavby</a>, která i nadále úspěšně pokračuje ve své činnosti. Díky našemu stabilnímu týmu prověřených subdodavatelů, se kterými nás pojí letitá partnerství, máme u každého bytu 100% kontrolu nad technickou kvalitou i těmi nejmenšími detaily.',
    teamDescription:
      'Naše síla spočívá v propojení tří klíčových rolí. Každý projekt prochází rukama naší rodiny od prvního nákresu až po finální předání klíčů:',
  },
  teamMembers: [
    {
      name: 'Stanislav Dvořák',
      role: 'Jednatel',
      subtitle: 'Garant technické kvality',
      description:
        'Stavím na dlouholetých zkušenostech v oboru stavebnictví. Do každého projektu vnáším technické know-how a smysl pro detail. Osobně garantuji, že naše rekonstrukce splňují nejvyšší standardy kvality a poctivého řemesla.',
      image: '/images/team/whatsapp-image-2026-04-14-at-21-46-59.jpeg',
      icon: 'hardhat',
      email: 'dvorak@ddhomeinvest.cz',
      phone: '',
    },
    {
      name: 'Irena Dvořáková',
      role: 'Jednatelka (Manželka)',
      subtitle: 'Estetické srdce firmy',
      description:
        'Stará se o to, aby interiéry byly nejen moderní, ale především útulné a funkční. Její cit pro detail a staging mění prázdné místnosti ve skutečné domovy.',
      image: '/images/team/mamka.jpeg',
      icon: 'palette',
      email: 'dvorakova@ddhomeinvest.cz',
      phone: '',
    },
    {
      name: 'Jan Minařík',
      role: 'Marketing a Media (Syn)',
      subtitle: 'Energie a Kreativita',
      description:
        'Jan vdechuje našim projektům digitální život. Stará se o to, aby krása a kvalita našich realizací byla vidět na první pohled. Má pod palcem kompletní propagaci, správu sociálních sítí a prezentaci našich bytů na realitním trhu.',
      image: '/images/team/ja.jpeg',
      icon: 'clipboard',
      email: 'minarik@ddhomeinvest.cz',
      phone: '',
    },
  ],
  philosophyContent: {
    sectionTitle: 'Naše filozofie',
    sectionSubtitle: 'Vlastní realizace, záruka kvality',
    paragraphs: [
      'Neprodáváme byty v původním stavu ani narychlo opravené. Těžíme z našich kořenů a vlastního realizačního zázemí. Když si kupujete domov od D&D HOMEINVEST, nekupujete jen čtyři stěny od anonymního investora. Kupujete výsledek práce rodiny, která staví na letitých zkušenostech a za každým detailem si stojí svým jménem.',
    ],
    highlights: [
      { number: '0', label: 'Dokončených projektů' },
      { number: '20+', label: 'Let zkušeností' },
      { number: '100%', label: 'Rodinná péče' },
      { number: '0', label: 'Kompromisů na kvalitě' },
    ],
  },
  ctaContent: {
    title: 'Hledáte svůj nový',
    highlight: 'domov',
    description: 'Prohlédněte si naše aktuální projekty.',
    primaryButton: 'Prohlédnout projekty',
    primaryLink: '#galerie',
    secondaryButton: 'Nezávazná konzultace',
    secondaryLink: '#kontakt',
  },
  galleryContent: {
    sectionTitle: 'Naše projekty',
    sectionSubtitle: 'Prohlédněte si naši aktuální nabídku i historii realizací',
    tabCurrent: 'Aktuální nabídka',
    tabSold: 'Historie prodejů',
  },
  currentProjects: [
    {
      id: 2,
      title: 'Budoucí byt 2+1',
      location: 'Bechyně',
      description: 'V realizaci.',
      status: 'Připravujeme',
      area: '67m2',
      price: 'Na dotaz',
      penb: 'C',
      slug: 'budouci-byt-2-1-bechyne',
      latitude: 49.2952,
      longitude: 14.4681,
      address: 'Bechyně, Jihočeský kraj',
      disposition: '2+1',
      floor: '',
      ownership: 'Osobní',
      completionDate: '',
      descriptionLong: 'Byt právě připravujeme. Podrobnosti budeme průběžně doplňovat.',
      features: [],
      timeline: [
        { title: 'Příprava projektu', description: 'Návrh dispozice a technického řešení.', status: 'done' },
        { title: 'Rekonstrukce', description: 'Kompletní realizace bytu.', status: 'current' },
        { title: 'Dokončení a prodej', description: 'Finální kontrola a předání novému majiteli.', status: 'upcoming' },
      ],
      images: ['/gallery/aktualni/p-ipravujeme.png'],
      tags: [],
    },
  ],
  soldProjects: [],
  contactContent: {
    sectionTitle: 'Kontakt',
    sectionSubtitle: 'Máte zájem? Ozvěte se nám',
    description: 'Rádi vám zodpovíme jakékoliv dotazy ohledně našich projektů.',
  },
  footerContent: {
    copyright: '',
    links: [
      { label: 'O nás', href: '#o-nas' },
      { label: 'Projekty', href: '#galerie' },
      { label: 'Kontakt', href: '#kontakt' },
    ],
  },
  legalInfo: {
    companyName: 'D&D HOMEINVEST s.r.o.',
    ico: '29483638',
    registeredOffice: 'Mažice 61, Jižní Čechy',
    tradeRegister:
      'Společnost je zapsaná v obchodním rejstříku vedeném Krajským soudem v Českých Budějovicích, oddíl C, vložka 36554',
    privacyPolicy: 'Zásady ochrany osobních údajů',
    termsOfService: 'Obchodní podmínky',
  },
  animations: DEFAULT_ANIMATIONS,
};

export function withComputedDefaults(content = DEFAULT_CONTENT) {
  return {
    ...DEFAULT_CONTENT,
    ...content,
    siteConfig: { ...DEFAULT_CONTENT.siteConfig, ...(content.siteConfig || {}) },
    heroContent: { ...DEFAULT_CONTENT.heroContent, ...(content.heroContent || {}) },
    aboutContent: { ...DEFAULT_CONTENT.aboutContent, ...(content.aboutContent || {}) },
    teamMembers: Array.isArray(content.teamMembers) ? content.teamMembers : DEFAULT_CONTENT.teamMembers,
    philosophyContent: {
      ...DEFAULT_CONTENT.philosophyContent,
      ...(content.philosophyContent || {}),
      paragraphs: Array.isArray(content.philosophyContent?.paragraphs)
        ? content.philosophyContent.paragraphs
        : DEFAULT_CONTENT.philosophyContent.paragraphs,
      highlights: Array.isArray(content.philosophyContent?.highlights)
        ? content.philosophyContent.highlights
        : DEFAULT_CONTENT.philosophyContent.highlights,
    },
    ctaContent: { ...DEFAULT_CONTENT.ctaContent, ...(content.ctaContent || {}) },
    galleryContent: { ...DEFAULT_CONTENT.galleryContent, ...(content.galleryContent || {}) },
    currentProjects: Array.isArray(content.currentProjects)
      ? content.currentProjects
      : DEFAULT_CONTENT.currentProjects,
    soldProjects: Array.isArray(content.soldProjects)
      ? content.soldProjects
      : DEFAULT_CONTENT.soldProjects,
    contactContent: { ...DEFAULT_CONTENT.contactContent, ...(content.contactContent || {}) },
    footerContent: {
      ...DEFAULT_CONTENT.footerContent,
      ...(content.footerContent || {}),
      copyright:
        content.footerContent?.copyright ||
        `© ${new Date().getFullYear()} ${content.siteConfig?.companyFullName || DEFAULT_CONTENT.siteConfig.companyFullName}. Všechna práva vyhrazena.`,
      links: Array.isArray(content.footerContent?.links)
        ? content.footerContent.links
        : DEFAULT_CONTENT.footerContent.links,
    },
    legalInfo: { ...DEFAULT_CONTENT.legalInfo, ...(content.legalInfo || {}) },
    animations: { ...DEFAULT_ANIMATIONS, ...(content.animations || {}) },
  };
}
