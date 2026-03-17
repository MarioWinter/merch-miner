"""Tests for keyword_extractor module (Task 8.11)."""

from scraper_app.scrapy_app.keyword_extractor import (
    _build_ngrams,
    _noun_score,
    _split_hyphens,
    _stem_plural,
    extract_keywords,
    filter_long_tail,
    filter_short_tail,
    normalize_text,
    tokenize,
)


# ------------------------------------------------------------------
# normalize_text
# ------------------------------------------------------------------


class TestNormalizeText:
    def test_html_entities(self):
        assert normalize_text("cat &amp; dog") == "cat dog"

    def test_parentheses_removed(self):
        assert normalize_text("gift (pack of 2)") == "gift"

    def test_special_chars_removed(self):
        assert normalize_text("funny! cat? @design") == "funny cat design"

    def test_hyphens_preserved(self):
        assert normalize_text("cat-lover shirt") == "cat-lover shirt"

    def test_whitespace_collapsed(self):
        assert normalize_text("  too   much   space  ") == "too much space"

    def test_lowercase(self):
        assert normalize_text("Funny CAT Shirts") == "funny cat shirts"

    def test_empty_string(self):
        assert normalize_text("") == ""

    def test_none(self):
        assert normalize_text(None) == ""


# ------------------------------------------------------------------
# _split_hyphens
# ------------------------------------------------------------------


class TestSplitHyphens:
    def test_compound_word(self):
        assert _split_hyphens("cat-lover") == ["cat-lover", "cat", "lover"]

    def test_no_hyphen(self):
        assert _split_hyphens("cat") == ["cat"]

    def test_triple_compound(self):
        result = _split_hyphens("dog-cat-fish")
        assert result == ["dog-cat-fish", "dog", "cat", "fish"]


# ------------------------------------------------------------------
# _stem_plural
# ------------------------------------------------------------------


class TestStemPlural:
    def test_teachers(self):
        assert _stem_plural("teachers") == "teacher"

    def test_gifts(self):
        assert _stem_plural("gifts") == "gift"

    def test_cats(self):
        assert _stem_plural("cats") == "cats"  # len <= 4: not stemmed

    def test_bus_exception(self):
        assert _stem_plural("bus") == "bus"

    def test_dress_exception(self):
        assert _stem_plural("dress") == "dress"

    def test_christmas_exception(self):
        assert _stem_plural("christmas") == "christmas"

    def test_short_word_no_stem(self):
        """Words <= 4 chars are not stemmed."""
        assert _stem_plural("dogs") == "dogs"

    def test_dishes_es_removal(self):
        assert _stem_plural("dishes") == "dish"

    def test_watches_es_removal(self):
        assert _stem_plural("watches") == "watch"

    def test_ies_to_y(self):
        assert _stem_plural("puppies") == "puppy"


# ------------------------------------------------------------------
# tokenize
# ------------------------------------------------------------------


class TestTokenize:
    def test_basic_tokenization(self):
        tokens = tokenize("funny cat teacher gift")
        assert "funny" in tokens
        assert "cat" in tokens
        assert "teacher" in tokens
        assert "gift" in tokens

    def test_junk_words_removed(self):
        tokens = tokenize("amp nbsp funny")
        assert "amp" not in tokens
        assert "nbsp" not in tokens
        assert "funny" in tokens

    def test_function_words_removed(self):
        tokens = tokenize("is in on funny cat")
        assert "is" not in tokens
        assert "in" not in tokens
        assert "funny" in tokens

    def test_short_words_removed(self):
        """Words < 2 chars are removed."""
        tokens = tokenize("a b cat")
        assert "a" not in tokens
        assert "b" not in tokens
        assert "cat" in tokens

    def test_hyphen_split(self):
        tokens = tokenize("cat-lover")
        assert "cat-lover" in tokens
        assert "cat" in tokens
        assert "lover" in tokens


# ------------------------------------------------------------------
# _noun_score
# ------------------------------------------------------------------


class TestNounScore:
    def test_mba_niche_noun(self):
        """cat, nurse, dad should score >= 0.3 via MBA_NICHE_NOUNS."""
        assert _noun_score("cat") >= 0.3
        assert _noun_score("nurse") >= 0.3
        assert _noun_score("dad") >= 0.3

    def test_mba_theme_word(self):
        assert _noun_score("funny") >= 0.3
        assert _noun_score("vintage") >= 0.3

    def test_long_word_with_suffix(self):
        assert _noun_score("teacher") >= 0.3  # suffix 'er' + length

    def test_short_generic_word(self):
        """Short generic words without MBA boost should fail."""
        assert _noun_score("red") < 0.3
        assert _noun_score("big") < 0.3


# ------------------------------------------------------------------
# filter_short_tail
# ------------------------------------------------------------------


class TestFilterShortTail:
    def test_stopwords_removed(self):
        tokens = ["for", "with", "cat", "teacher"]
        result = filter_short_tail(tokens)
        assert "for" not in result
        assert "with" not in result

    def test_mba_words_pass(self):
        tokens = ["cat", "nurse", "dad", "funny"]
        result = filter_short_tail(tokens)
        assert "cat" in result
        assert "nurse" in result
        assert "dad" in result
        assert "funny" in result

    def test_stopwords_fail(self):
        tokens = ["shirt", "men", "women"]
        result = filter_short_tail(tokens)
        assert len(result) == 0


# ------------------------------------------------------------------
# filter_long_tail
# ------------------------------------------------------------------


class TestFilterLongTail:
    def test_stopwords_allowed(self):
        tokens = ["gift", "for", "nurse"]
        result = filter_long_tail(tokens)
        assert "for" in result
        assert "gift" in result
        assert "nurse" in result

    def test_junk_words_removed(self):
        tokens = ["amp", "gift", "nbsp"]
        result = filter_long_tail(tokens)
        assert "amp" not in result
        assert "nbsp" not in result
        assert "gift" in result


# ------------------------------------------------------------------
# _build_ngrams
# ------------------------------------------------------------------


class TestBuildNgrams:
    def test_bigrams(self):
        tokens = ["funny", "cat", "teacher"]
        result = _build_ngrams(tokens, 2)
        assert result == ["funny cat", "cat teacher"]

    def test_trigrams(self):
        tokens = ["funny", "cat", "teacher", "gift"]
        result = _build_ngrams(tokens, 3)
        assert result == ["funny cat teacher", "cat teacher gift"]

    def test_too_few_tokens(self):
        tokens = ["funny"]
        assert _build_ngrams(tokens, 2) == []


# ------------------------------------------------------------------
# extract_keywords e2e
# ------------------------------------------------------------------


class TestExtractKeywords:
    def test_empty_products(self):
        result = extract_keywords([], "test")
        assert result['per_product'] == []
        assert result['global_top_focus'] == []
        assert result['global_top_long_tail'] == []
        assert result['all_flat'] == ''

    def test_basic_extraction(self):
        products = [
            {'title': 'Funny Cat Teacher T-Shirt', 'brand': 'CatBrand',
             'bullet_1': 'Perfect gift for cat lovers', 'bullet_2': None,
             'description': 'Great teacher gift'},
            {'title': 'Funny Cat Nurse T-Shirt', 'brand': 'CatBrand',
             'bullet_1': 'Perfect gift for cat owners', 'bullet_2': None,
             'description': 'Great nurse gift'},
            {'title': 'Funny Cat Dad T-Shirt', 'brand': 'CatBrand',
             'bullet_1': 'Perfect gift for cat dad', 'bullet_2': None,
             'description': 'Great dad gift'},
            {'title': 'Funny Cat Mom T-Shirt', 'brand': 'CatBrand',
             'bullet_1': 'Perfect gift for cat mom', 'bullet_2': None,
             'description': 'Great mom gift'},
        ]
        result = extract_keywords(products, "funny cat shirts")

        # per_product populated
        assert len(result['per_product']) == 4
        for pp in result['per_product']:
            assert 'short_tail' in pp
            assert 'long_tail' in pp

        # cat should appear in short_tail for all products
        all_short_tail = set()
        for pp in result['per_product']:
            all_short_tail.update(pp['short_tail'])
        assert 'cat' in all_short_tail
        assert 'funny' in all_short_tail

    def test_brand_separation(self):
        """Brand tokens should still appear in results but not dominate."""
        products = [
            {'title': 'Funny Cat T-Shirt', 'brand': 'SuperBrand',
             'bullet_1': None, 'bullet_2': None, 'description': None},
        ]
        result = extract_keywords(products)

        # Should not crash and should produce results
        assert len(result['per_product']) == 1

    def test_all_flat_string(self):
        products = [
            {'title': 'Cat Teacher Gift', 'brand': None,
             'bullet_1': None, 'bullet_2': None, 'description': None},
        ]
        result = extract_keywords(products, "cat")
        assert isinstance(result['all_flat'], str)

    def test_per_product_capped_at_30(self):
        """BUG-P8-03: per-product short_tail and long_tail capped at 30."""
        many_nouns = ' '.join(
            f'{w}shirt' for w in [
                'alpha', 'bravo', 'charlie', 'delta', 'echo',
                'foxtrot', 'golf', 'hotel', 'india', 'juliet',
                'kilo', 'lima', 'mike', 'november', 'oscar',
                'papa', 'quebec', 'romeo', 'sierra', 'tango',
                'uniform', 'victor', 'whiskey', 'xray', 'yankee',
                'zulu', 'amber', 'bronze', 'coral', 'denim',
                'ebony', 'flint',
            ]
        )
        products = [
            {'title': many_nouns, 'brand': None,
             'bullet_1': many_nouns, 'bullet_2': many_nouns,
             'description': many_nouns},
        ]
        result = extract_keywords(products)
        pp = result['per_product'][0]
        assert len(pp['short_tail']) <= 30
        assert len(pp['long_tail']) <= 30

    def test_ngrams_exclude_no_noun_tokens(self):
        """BUG-P8-04: n-grams with no noun-like tokens are excluded."""
        products = [
            {'title': 'for the with on by at in to of up',
             'brand': None, 'bullet_1': None, 'bullet_2': None,
             'description': None},
        ]
        result = extract_keywords(products)
        pp = result['per_product'][0]
        # All pure-stopword n-grams should be filtered out
        for ngram in pp['long_tail']:
            tokens = ngram.split()
            assert any(_noun_score(t) >= 0.3 for t in tokens), (
                f"n-gram '{ngram}' has no noun-like token"
            )
