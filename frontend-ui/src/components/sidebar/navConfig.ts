export interface NavItem {
  labelKey: string;
  path: string;
  iconName: string;
}

export interface NavSection {
  sectionKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    sectionKey: 'controlRoom',
    items: [
      { labelKey: 'nav.dashboard', path: '/dashboard', iconName: 'DashboardOutlined' },
      { labelKey: 'nav.reports', path: '/reports', iconName: 'BarChartOutlined' },
    ],
  },
  {
    sectionKey: 'pipeline',
    items: [
      { labelKey: 'nav.niches', path: '/niches', iconName: 'ListAltOutlined' },
      { labelKey: 'nav.research', path: '/research', iconName: 'SearchOutlined' },
      { labelKey: 'nav.slogans', path: '/slogans', iconName: 'LightbulbOutlined' },
      { labelKey: 'nav.designs', path: '/designs', iconName: 'BrushOutlined' },
      { labelKey: 'nav.listings', path: '/listings', iconName: 'ArticleOutlined' },
    ],
  },
  {
    sectionKey: 'drillingZone',
    items: [
      { labelKey: 'nav.amazonResearch', path: '/amazon/research', iconName: 'QueryStatsOutlined' },
      { labelKey: 'nav.keywords', path: '/amazon/keywords', iconName: 'VpnKeyOutlined' },
    ],
  },
  {
    sectionKey: 'surfaceOps',
    items: [
      { labelKey: 'nav.uploads', path: '/uploads', iconName: 'CloudUploadOutlined' },
      { labelKey: 'nav.kanban', path: '/kanban', iconName: 'ViewKanbanOutlined' },
    ],
  },
];

export const SECTION_KEYS = ['controlRoom', 'pipeline', 'drillingZone', 'surfaceOps'] as const;
