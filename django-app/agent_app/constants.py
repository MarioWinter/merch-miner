"""Default seed data for agent system (presets, templates, permissions)."""

# ── All tool names across all sub-agents ──
ALL_TOOLS = [
    # Research Agent (AC-12)
    'create_niche', 'update_niche_status', 'read_niche_details',
    'trigger_deep_research', 'read_research_results',
    'trigger_product_research', 'read_product_results', 'find_similar_niches',
    # Ideation Agent (AC-13)
    'create_manual_idea', 'trigger_slogan_adaptation', 'read_adaptation_results',
    'approve_reject_idea', 'read_keyword_bank', 'add_keyword', 'find_similar_ideas',
    # Design Agent (AC-14)
    'get_design_board_context', 'analyze_reference_image', 'generate_design',
    'read_design_status', 'approve_reject_design', 'trigger_batch_processing',
    # Listing Agent (AC-15)
    'generate_listing', 'read_listing', 'update_listing',
    'mark_listing_ready', 'export_listing',
    # Publishing Agent (AC-16)
    'create_upload_job', 'read_upload_status', 'update_kanban_status',
    'read_kanban_board',
    # Search Agent (AC-17)
    'semantic_search', 'find_similar_content', 'web_search',
    'deep_crawl', 'save_to_niche', 'save_knowledge',
]

# ── Tool → sub-agent mapping (for isolation enforcement) ──
TOOL_AGENT_MAP = {
    # Research
    'create_niche': 'research',
    'update_niche_status': 'research',
    'read_niche_details': 'research',
    'trigger_deep_research': 'research',
    'read_research_results': 'research',
    'trigger_product_research': 'research',
    'read_product_results': 'research',
    'find_similar_niches': 'research',
    # Ideation
    'create_manual_idea': 'ideation',
    'trigger_slogan_adaptation': 'ideation',
    'read_adaptation_results': 'ideation',
    'approve_reject_idea': 'ideation',
    'read_keyword_bank': 'ideation',
    'add_keyword': 'ideation',
    'find_similar_ideas': 'ideation',
    # Design
    'get_design_board_context': 'design',
    'analyze_reference_image': 'design',
    'generate_design': 'design',
    'read_design_status': 'design',
    'approve_reject_design': 'design',
    'trigger_batch_processing': 'design',
    # Listing
    'generate_listing': 'listing',
    'read_listing': 'listing',
    'update_listing': 'listing',
    'mark_listing_ready': 'listing',
    'export_listing': 'listing',
    # Publishing
    'create_upload_job': 'publishing',
    'read_upload_status': 'publishing',
    'update_kanban_status': 'publishing',
    'read_kanban_board': 'publishing',
    # Search
    'semantic_search': 'search',
    'find_similar_content': 'search',
    'web_search': 'search',
    'deep_crawl': 'search',
    'save_to_niche': 'search',
    'save_knowledge': 'search',
}

# ── Default permission levels per tool (AC-19: Assisted preset) ──
DEFAULT_TOOL_PERMISSIONS = {
    # Auto: read/search tools
    'read_niche_details': 'auto',
    'read_research_results': 'auto',
    'read_product_results': 'auto',
    'find_similar_niches': 'auto',
    'read_adaptation_results': 'auto',
    'read_keyword_bank': 'auto',
    'find_similar_ideas': 'auto',
    'get_design_board_context': 'auto',
    'read_design_status': 'auto',
    'read_listing': 'auto',
    'read_upload_status': 'auto',
    'read_kanban_board': 'auto',
    'semantic_search': 'auto',
    'find_similar_content': 'auto',
    'web_search': 'auto',
    'export_listing': 'auto',
    # Notify: create/update tools
    'create_niche': 'notify',
    'update_niche_status': 'notify',
    'add_keyword': 'notify',
    'update_kanban_status': 'notify',
    'create_manual_idea': 'notify',
    'approve_reject_idea': 'notify',
    'approve_reject_design': 'notify',
    'update_listing': 'notify',
    'mark_listing_ready': 'notify',
    'save_to_niche': 'notify',
    'save_knowledge': 'notify',
    'analyze_reference_image': 'notify',
    'deep_crawl': 'notify',
    # Approve: expensive/destructive tools
    'trigger_deep_research': 'approve',
    'trigger_product_research': 'approve',
    'trigger_slogan_adaptation': 'approve',
    'generate_design': 'approve',
    'generate_listing': 'approve',
    'create_upload_job': 'approve',
    'trigger_batch_processing': 'approve',
}

# ── 3 system autonomy presets (AC-6) ──
SYSTEM_PRESETS = [
    {
        'name': 'Supervised',
        'permissions': {tool: 'approve' for tool in ALL_TOOLS},
    },
    {
        'name': 'Assisted',
        'permissions': DEFAULT_TOOL_PERMISSIONS,
    },
    {
        'name': 'Autonomous',
        'permissions': {
            tool: ('approve' if tool == 'create_upload_job' else 'auto')
            for tool in ALL_TOOLS
        },
    },
]

# ── 5 system workflow templates (AC-24) ──
SYSTEM_TEMPLATES = [
    {
        'name': 'Full Pipeline',
        'key': 'full_pipeline',
        'steps': [
            {'agent_type': 'research', 'action': 'deep_research', 'description': 'Run deep niche research'},
            {'agent_type': 'research', 'action': 'product_research', 'description': 'Scrape Amazon products'},
            {'agent_type': 'ideation', 'action': 'slogan_generation', 'description': 'Generate slogans and ideas'},
            {'agent_type': 'design', 'action': 'design_generation', 'description': 'Generate designs'},
            {'agent_type': 'listing', 'action': 'listing_generation', 'description': 'Create listings'},
            {'agent_type': 'publishing', 'action': 'publish', 'description': 'Prepare for upload'},
        ],
    },
    {
        'name': 'Research Only',
        'key': 'research_only',
        'steps': [
            {'agent_type': 'research', 'action': 'deep_research', 'description': 'Run deep niche research'},
            {'agent_type': 'research', 'action': 'product_research', 'description': 'Scrape Amazon products'},
        ],
    },
    {
        'name': 'Ideation',
        'key': 'ideation',
        'steps': [
            {'agent_type': 'ideation', 'action': 'slogan_generation', 'description': 'Generate slogans'},
            {'agent_type': 'ideation', 'action': 'adaptation', 'description': 'Adapt and refine slogans'},
        ],
    },
    {
        'name': 'Design Sprint',
        'key': 'design_sprint',
        'steps': [
            {'agent_type': 'design', 'action': 'design_generation', 'description': 'Generate designs'},
            {'agent_type': 'design', 'action': 'batch_processing', 'description': 'Batch process designs'},
        ],
    },
    {
        'name': 'Listing Finalize',
        'key': 'listing_finalize',
        'steps': [
            {'agent_type': 'listing', 'action': 'listing_generation', 'description': 'Generate listings'},
            {'agent_type': 'listing', 'action': 'keywords', 'description': 'Optimize keywords'},
            {'agent_type': 'listing', 'action': 'finalize', 'description': 'Mark listings ready'},
        ],
    },
]

# ── Personality presets per agent type (AC-55e) ──
PERSONALITY_PRESETS = {
    'orchestrator': [
        {'name': 'Projektleiter', 'text': 'Strukturiert, klar, gibt kurze Status-Updates. Delegiert effizient und fasst Ergebnisse zusammen.'},
        {'name': 'Creative Director', 'text': 'Enthusiastisch, visionaer, denkt in Konzepten. Gibt kreative Impulse und motiviert das Team.'},
        {'name': 'Minimalist', 'text': 'Extrem knapp, nur das Noetigste. Keine Floskeln, nur Fakten und Aktionen.'},
    ],
    'research': [
        {'name': 'Analyst', 'text': 'Datengetrieben, nuechtern, liefert Fakten mit Quellen. Bewertet Niches objektiv.'},
        {'name': 'Scout', 'text': 'Neugierig, entdeckerfreudig, begeistert sich fuer neue Trends. Liefert Kontext und Hintergrund.'},
    ],
    'ideation': [
        {'name': 'Texter', 'text': 'Wortgewandt, spielt mit Sprache, liefert mehrere Varianten. Denkt in Zielgruppen.'},
        {'name': 'Brainstormer', 'text': 'Schnell, assoziativ, unkonventionell. Quantitaet vor Qualitaet, filtert spaeter.'},
    ],
    'design': [
        {'name': 'Art Director', 'text': 'Visuell praezise, beschreibt Designs in Detail. Achtet auf Komposition und Farbharmonie.'},
        {'name': 'Experimentator', 'text': 'Probiert ungewoehnliche Stile, mixt Aesthetiken. Liefert ueberraschende Ergebnisse.'},
    ],
    'listing': [
        {'name': 'SEO-Profi', 'text': 'Keyword-fokussiert, optimiert fuer Rankings. Jedes Wort hat einen Zweck.'},
        {'name': 'Copywriter', 'text': 'Ueberzeugend, emotional, verkaufsstark. Schreibt Listings die konvertieren.'},
    ],
    'publishing': [
        {'name': 'Koordinator', 'text': 'Checklisten-Typ, ueberprueft alles doppelt. Stellt sicher dass nichts fehlt.'},
    ],
    'search': [
        {'name': 'Rechercheur', 'text': 'Gruendlich, graebt tief, findet auch obskure Quellen. Fasst kompakt zusammen.'},
    ],
}

# ── Tool descriptions for frontend display ──
TOOL_DESCRIPTIONS = {
    'create_niche': 'Create a new niche',
    'update_niche_status': 'Update niche status',
    'read_niche_details': 'Read niche details',
    'trigger_deep_research': 'Trigger deep niche research (costs API credits)',
    'read_research_results': 'Read research results',
    'trigger_product_research': 'Trigger Amazon product scrape (costs API credits)',
    'read_product_results': 'Read product results',
    'find_similar_niches': 'Find similar niches via vector search',
    'create_manual_idea': 'Create a new idea/slogan',
    'trigger_slogan_adaptation': 'Trigger AI slogan adaptation (costs API credits)',
    'read_adaptation_results': 'Read adaptation results',
    'approve_reject_idea': 'Approve or reject an idea',
    'read_keyword_bank': 'Read keyword bank',
    'add_keyword': 'Add keyword to bank',
    'find_similar_ideas': 'Find similar ideas via vector search',
    'get_design_board_context': 'Read design board context',
    'analyze_reference_image': 'Analyze a reference image',
    'generate_design': 'Generate AI design (costs API credits)',
    'read_design_status': 'Read design generation status',
    'approve_reject_design': 'Approve or reject a design',
    'trigger_batch_processing': 'Trigger batch design processing (costs API credits)',
    'generate_listing': 'Generate listing copy (costs API credits)',
    'read_listing': 'Read listing',
    'update_listing': 'Update listing fields',
    'mark_listing_ready': 'Mark listing as ready for upload',
    'export_listing': 'Export listing data',
    'create_upload_job': 'Create MBA upload job (irreversible)',
    'read_upload_status': 'Read upload status',
    'update_kanban_status': 'Move kanban card',
    'read_kanban_board': 'Read kanban board',
    'semantic_search': 'Semantic search across workspace data',
    'find_similar_content': 'Find similar content via vector search',
    'web_search': 'Search the web via SearXNG',
    'deep_crawl': 'Deep crawl a URL via Crawl4ai',
    'save_to_niche': 'Save search result to niche',
    'save_knowledge': 'Save knowledge document',
}
