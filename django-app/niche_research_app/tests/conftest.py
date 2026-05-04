"""Shared fixtures for niche_research_app tests."""

import asyncio

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from niche_app.models import Niche
from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
    ResearchNodeConfig,
)
from scraper_app.models import AmazonProduct, Keyword
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace


# ---------------------------------------------------------------------------
# Asyncio loop hygiene — Python 3.12 deprecates `asyncio.get_event_loop()`
# returning an implicit loop. Without a fresh loop per test, full-suite runs
# leak/close the implicit loop, causing
# "RuntimeError: There is no current event loop in thread 'MainThread'" in
# every subsequent niche-research test. Isolated runs work because each pytest
# session starts with a clean implicit loop.
#
# This autouse fixture provides a fresh, owned loop per test — invisible to
# test bodies that still use `asyncio.get_event_loop().run_until_complete(...)`.
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_event_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        yield loop
    finally:
        try:
            loop.close()
        finally:
            asyncio.set_event_loop(None)


# ---------------------------------------------------------------------------
# User / Workspace helpers
# ---------------------------------------------------------------------------

def _make_user(email, password='TestPass123!', **kwargs):
    return User.objects.create_user(
        email=email, password=password, username=email,
        is_active=True, **kwargs,
    )


def _auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies['access_token'] = token
    return client


@pytest.fixture
def user_with_workspace(db):
    """Create user + auto-created workspace + admin membership."""
    user = _make_user('researcher@test.com')
    workspace = Workspace.objects.get(owner=user)
    Membership.objects.get(user=user, workspace=workspace)
    return user, workspace


@pytest.fixture
def other_user_workspace(db):
    """Second user + workspace for isolation tests."""
    user = _make_user('other@test.com')
    workspace = Workspace.objects.get(owner=user)
    return user, workspace


@pytest.fixture
def niche(user_with_workspace):
    """A niche in the test workspace."""
    user, workspace = user_with_workspace
    return Niche.objects.create(
        workspace=workspace,
        name='Fishing',
        created_by=user,
    )


@pytest.fixture
def other_niche(user_with_workspace):
    """Second niche in the same workspace."""
    user, workspace = user_with_workspace
    return Niche.objects.create(
        workspace=workspace,
        name='Camping',
        created_by=user,
    )


@pytest.fixture
def auth_client(user_with_workspace):
    """Authenticated API client for the test user."""
    user, _ = user_with_workspace
    return _auth_client(user)


@pytest.fixture
def other_auth_client(other_user_workspace):
    """Authenticated API client for a user NOT in the niche's workspace."""
    user, _ = other_user_workspace
    return _auth_client(user)


# ---------------------------------------------------------------------------
# Scraper models (AmazonProduct, Keyword)
# ---------------------------------------------------------------------------

@pytest.fixture
def keyword(db):
    return Keyword.objects.create(keyword='Fishing', marketplace='amazon_com')


@pytest.fixture
def amazon_products(keyword):
    """3 AmazonProducts linked to the keyword."""
    products = []
    for i in range(3):
        p = AmazonProduct.objects.create(
            asin=f'B00TEST000{i}',
            marketplace='amazon_com',
            title=f'Funny Fishing T-Shirt {i}',
            brand=f'FishBrand{i}',
            rating=4.5,
            reviews_count=100 + i,
            thumbnail_url=f'https://images.amazon.com/thumb{i}.jpg',
            product_url=f'https://amazon.com/dp/B00TEST000{i}',
        )
        p.keywords.add(keyword)
        products.append(p)
    return products


# ---------------------------------------------------------------------------
# Research Node Config
# ---------------------------------------------------------------------------

@pytest.fixture
def research_configs(db):
    """Seed all 4 ResearchNodeConfig rows."""
    configs = []
    for node in ResearchNodeConfig.NodeName.values:
        c, _ = ResearchNodeConfig.objects.get_or_create(
            node_name=node,
            defaults={
                'model_name': 'openai/gpt-4.1-mini',
                'temperature': 0.3,
                'system_prompt': f'Default prompt for {node}',
            },
        )
        configs.append(c)
    return configs


# ---------------------------------------------------------------------------
# Full research run (completed) for detail/serializer tests
# ---------------------------------------------------------------------------

SAMPLE_PATTERN_ANALYSIS = [
    {'name': 'IDENTITY DECLARATION', 'present': True, 'context': 'Slogans like "I am a fisherman"'},
    {'name': 'GROUP LEADER', 'present': False, 'context': 'No leadership slogans found.'},
    {'name': 'TRIBE/COMMUNITY', 'present': True, 'context': '"Fishing crew" slogans detected.'},
    {'name': 'FUNNY ACTIVITY', 'present': True, 'context': 'Humor about fishing activities.'},
    {'name': 'CROSS-NICHE EVENTS', 'present': False, 'context': 'No seasonal variants.'},
    {'name': 'CROSS-NICHE MASHUP', 'present': False, 'context': 'No mashups found.'},
    {'name': 'ADDICTION/OBSESSION', 'present': True, 'context': '"Addicted to fishing" slogans.'},
    {'name': 'VINTAGE/LEGACY', 'present': False, 'context': 'No vintage slogans.'},
    {'name': 'ACHIEVEMENT/GAMIFIED', 'present': False, 'context': 'No achievement slogans.'},
    {'name': 'JOB/PROFESSION PARODY', 'present': False, 'context': 'No job parodies.'},
    {'name': 'RELATIONSHIP HUMOR', 'present': False, 'context': 'No relationship humor.'},
    {'name': 'BOUNDARY/GATEKEEPING', 'present': False, 'context': 'No boundary slogans.'},
    {'name': 'ENDURANCE/SURVIVAL', 'present': False, 'context': 'No endurance slogans.'},
    {'name': 'COMPETENCE/EXPERTISE', 'present': False, 'context': 'No expertise slogans.'},
    {'name': 'CHAOS/CONTROL', 'present': False, 'context': 'No chaos slogans.'},
    {'name': 'SELF-CARE/PRIORITIES', 'present': False, 'context': 'No self-care slogans.'},
]


@pytest.fixture
def completed_research(niche, user_with_workspace, amazon_products, research_configs):
    """A fully completed research with all child records."""
    user, workspace = user_with_workspace
    from django.utils import timezone

    research = NicheResearch.objects.create(
        niche=niche,
        triggered_by=user,
        status=NicheResearch.Status.COMPLETED,
        completed_at=timezone.now(),
        config_snapshot={'vision_analyze': {'model_name': 'openai/gpt-4.1-mini'}},
    )

    # Research products
    for p in amazon_products:
        NicheResearchProduct.objects.create(research=research, product=p)

    # Vision analyses
    for p in amazon_products:
        NicheProductVisionAnalysis.objects.create(
            research=research,
            product=p,
            slogan_text=f'Gone Fishing {p.asin}',
            meaning_context='Fishing lifestyle pride',
            visual_style='Cartoon, playful',
            graphic_elements='Fish icon, bold text',
            layout_composition='Sandwich layout',
            is_niche_match=True,
        )

    # Emotional analyses
    for p in amazon_products:
        NicheProductEmotionalAnalysis.objects.create(
            research=research,
            product=p,
            original_slogan=f'Gone Fishing {p.asin}',
            customer_psychology={
                'buyer_profile': 'Weekend angler',
                'emotional_need': 'Identity expression',
                'internal_monologue': 'I love fishing.',
                'what_they_cant_say_out_loud': 'Fishing is my escape.',
            },
            sentiment_analysis={
                'sentiment': 'Positive',
                'primary_emotion': 'Pride',
                'emotion_target': 'Self',
                'confrontation_level': 'Low',
                'workplace_culture_required': 'Peer-based',
                'humor_style': 'Warm',
                'humor_function': 'Pride',
            },
            emotional_pattern='1: IDENTITY DECLARATION',
            vibe={
                'energy_level': 'Medium',
                'attitude': 'Proud and relaxed',
                'core_emotion': 'Contentment',
            },
            semantic_structure={
                'structural_template': 'Activity + Identity',
                'wordplay_type': 'None',
                'delivery_style': 'Direct',
            },
            key_elements=['fishing', 'pride', 'identity'],
            tone='Warm and proud',
            adaptation_formula='[Activity] + [Identity Claim]',
            adaptation_examples=['Gone Hiking', 'Gone Camping'],
            transferability_notes={
                'works_best_in': ['outdoor niches'],
                'avoid_in': ['formal niches'],
                'critical_success_factors': ['authentic voice'],
            },
        )

    # Niche analysis
    NicheAnalysis.objects.create(
        research=research,
        niche=niche,
        niche_summary='Fishing niche: pride-driven identity expression.',
        sentiment='Positive',
        primary_emotions=['Pride', 'Joy', 'Contentment'],
        emotional_archetype=['Everyman/Orphan', 'Explorer'],
        example_keywords=['fishing', 'angler', 'bass', 'reel', 'tackle'],
        pattern_analysis=SAMPLE_PATTERN_ANALYSIS,
        emotional_reality='Buyers purchase identity validation.',
        design_concepts='Nature-themed identity clothing for outdoor enthusiasts.',
        dominant_design_aesthetics='Earth tones, bold sans-serif, fish vectors.',
    )

    # Keyword analysis
    NicheKeywordAnalysis.objects.create(
        research=research,
        niche=niche,
        main_short_tail=['fishing', 'angler', 'bass'],
        main_long_tail=['funny fishing shirt', 'bass fishing gift'],
        all_keywords_flat='fishing, angler, bass, funny fishing shirt',
        top_focus_keywords=['fishing', 'angler'],
        top_long_tail_keywords=['funny fishing shirt'],
    )

    return research
