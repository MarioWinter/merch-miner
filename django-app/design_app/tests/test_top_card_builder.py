"""PROJ-34 Phase 13t-c — top_card_builder unit tests.

Covers:
- preset dict shape (all 17 expected keys present)
- structural is_raw flags (visual / style_dna / extra_context always True)
- source_card_type / source_card_references shape
- preset_label rules: deterministic, ≤200 chars, fallback chain
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from design_app.services.top_card_builder import (
    _generate_preset_label,
    build_top_card_preset,
)
from niche_app.models import Niche
from niche_research_app.models import (
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


EXPECTED_KEYS = {
    "slot_spatial_configuration",
    "slot_visual_description",
    "slot_typography_adjectives",
    "slot_font_combination",
    "slot_accessories",
    "slot_style_dna",
    "slot_extra_context",
    "spatial_is_raw",
    "visual_is_raw",
    "typography_is_raw",
    "font_combination_is_raw",
    "accessories_is_raw",
    "style_dna_is_raw",
    "extra_context_is_raw",
    "reference_thumbnail_url",
    "source_card_type",
    "source_card_references",
    "preset_label",
}


# ─── Fixtures ────────────────────────────────────────────────────────────


def _setup_niche_and_vision(
    *,
    slogan_text: str = "Stay Bold Always",
    meaning_context: str = "An anthem for fearless plumbers.",
    visual_style: str = "vintage halftone, mustard and navy",
    graphic_elements: str = "skull with a wrench, bold stencil letters, sparse dots",
    layout_composition: str = (
        "headline top illustration centre slogan bottom thin geometric border"
    ),
    thumbnail_url: str = "https://images.example.com/plumber.jpg",
):
    email = "topcard@example.com"
    user = User.objects.create_user(email=email, password="pw", username=email)
    workspace = Workspace.objects.create(
        name="TopCard WS", slug="topcard-ws", owner=user,
    )
    Membership.objects.create(
        workspace=workspace, user=user, role="admin", status="active",
    )
    niche = Niche.objects.create(
        workspace=workspace, name="Vintage Plumbers", created_by=user,
    )
    research = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    product = AmazonProduct.objects.create(
        asin="BTOPCARD01",
        marketplace="amazon_com",
        title="Vintage Skull Plumber Tee",
        thumbnail_url=thumbnail_url,
    )
    NicheResearchProduct.objects.create(
        research=research, product=product, brand_blocked=False,
    )
    vision = NicheProductVisionAnalysis.objects.create(
        research=research,
        product=product,
        slogan_text=slogan_text,
        meaning_context=meaning_context,
        visual_style=visual_style,
        graphic_elements=graphic_elements,
        layout_composition=layout_composition,
        is_niche_match=True,
    )
    return niche, vision


# ─── Shape + flag tests ──────────────────────────────────────────────────


def test_full_preset_shape():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert set(result.keys()) == EXPECTED_KEYS


def test_visual_always_raw():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert result["visual_is_raw"] is True


def test_style_dna_always_raw():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert result["style_dna_is_raw"] is True


def test_extra_context_always_raw():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert result["extra_context_is_raw"] is True


def test_source_card_type_is_top():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert result["source_card_type"] == "top"


def test_source_card_references_structure():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    refs = result["source_card_references"]
    assert isinstance(refs, list)
    assert len(refs) == 1
    entry = refs[0]
    assert set(entry.keys()) == {"niche_id", "product_ids"}
    assert entry["niche_id"] == str(niche.id)
    assert entry["product_ids"] == [str(vision.product_id)]


def test_thumbnail_url_propagated_and_capped():
    long_url = "https://images.example.com/" + ("x" * 600)
    niche, vision = _setup_niche_and_vision(thumbnail_url=long_url)
    result = build_top_card_preset(vision, niche)
    assert result["reference_thumbnail_url"].startswith(
        "https://images.example.com/",
    )
    assert len(result["reference_thumbnail_url"]) <= 500


def test_slot_values_are_strings():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    for key in [
        "slot_spatial_configuration",
        "slot_visual_description",
        "slot_typography_adjectives",
        "slot_font_combination",
        "slot_accessories",
        "slot_style_dna",
        "slot_extra_context",
    ]:
        assert isinstance(result[key], str)


def test_visual_description_passes_through_in_full():
    """Phase 13t-r: SLOT_MAX_RAW_LEN removed — long descriptors no longer truncated."""
    long_graphic = "skull " * 200  # 1200 chars
    niche, vision = _setup_niche_and_vision(graphic_elements=long_graphic)
    result = build_top_card_preset(vision, niche)
    assert len(result["slot_visual_description"]) > 200


# ─── Label generator tests ───────────────────────────────────────────────


def test_preset_label_under_200_chars():
    niche, vision = _setup_niche_and_vision()
    result = build_top_card_preset(vision, niche)
    assert len(result["preset_label"]) <= 200


def test_preset_label_deterministic():
    niche, vision = _setup_niche_and_vision()
    first = _generate_preset_label(vision)
    second = _generate_preset_label(vision)
    assert first == second


def test_preset_label_uses_slogan_first_two_words():
    niche, vision = _setup_niche_and_vision(
        slogan_text="Vintage Skull Power",
        graphic_elements="bold wrench illustration",
    )
    label = _generate_preset_label(vision)
    assert label.startswith("Vintage Skull")


def test_preset_label_appends_graphic_keyword():
    niche, vision = _setup_niche_and_vision(
        slogan_text="Stay Bold",
        graphic_elements="skull with wrench and stencil letters",
    )
    label = _generate_preset_label(vision)
    parts = label.split()
    # 2 slogan words + 1 graphic keyword
    assert len(parts) >= 3


def test_preset_label_fallback_no_slogan():
    niche, vision = _setup_niche_and_vision(
        slogan_text="",
        graphic_elements="vintage skull plumber wrench illustration",
    )
    label = _generate_preset_label(vision)
    assert label != "Untitled Preset"
    assert "Vintage" in label or "Skull" in label or "Plumber" in label


def test_preset_label_fallback_empty_everything():
    niche, vision = _setup_niche_and_vision(
        slogan_text="",
        graphic_elements="",
    )
    label = _generate_preset_label(vision)
    assert label == "Untitled Preset"


def test_preset_label_drops_stopwords_and_short_fragments():
    niche, vision = _setup_niche_and_vision(
        slogan_text="The a of and",
        graphic_elements="a is to on",
    )
    label = _generate_preset_label(vision)
    assert label == "Untitled Preset"


def test_preset_label_strips_t_shirt_artifacts():
    """`t-shirt` and similar generic tokens must not appear in labels."""
    niche, vision = _setup_niche_and_vision(
        slogan_text="t-shirt design",
        graphic_elements="t-shirt graphic art",
    )
    label = _generate_preset_label(vision)
    assert "t-shirt" not in label.lower()
    assert "shirt" not in label.lower()


def test_preset_label_titlecased():
    niche, vision = _setup_niche_and_vision(
        slogan_text="stay bold always",
        graphic_elements="skull illustration",
    )
    label = _generate_preset_label(vision)
    for word in label.split():
        assert word[0].isupper(), f"Word '{word}' not title-cased"


# ─── Built-in matching sanity ────────────────────────────────────────────


def test_matcher_can_produce_builtin_id_for_spatial():
    """When layout_composition shares many tokens with a built-in's prompt
    text, spatial_is_raw should flip to False."""
    rich_spatial = (
        "pyramid word-stack layout 4 to 5 stacked text lines forming pyramid "
        "top line shortest smallest each subsequent line wider bolder bottom "
        "line dominant emphasis word no illustration tight vertical spacing"
    )
    niche, vision = _setup_niche_and_vision(layout_composition=rich_spatial)
    result = build_top_card_preset(vision, niche)
    assert result["spatial_is_raw"] is False
    assert result["slot_spatial_configuration"] == "pyramid_stack"
