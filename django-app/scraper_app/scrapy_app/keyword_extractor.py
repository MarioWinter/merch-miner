"""MetaKeyword extraction engine for MBA product data.

Extracts short-tail (focus) and long-tail keywords from product titles,
brands, bullets, and descriptions. Improvements over n8n JS implementation:
MBA-specific noun categories, hyphen-split, brand-token separation,
light plural stemming, single normalization pass, clean filter pipeline.
"""

import html
import re
from collections import Counter


# ---------------------------------------------------------------------------
# Word lists (ported from n8n + expanded)
# ---------------------------------------------------------------------------

STOPWORDS = frozenset({
    'for', 'with', 'the', 'tshirt', 'shirt', 'men', 'women', 'colors',
    'sizes', 'and', 'top', 'tank', 'long', 'sleeve', 'hoodie', 'pullover',
    'sweatshirt', 'tee', 'kids', 'boys', 'girls', 'youth', 'adult',
    'adults', 'unisex', 'graphic', 'novelty', 'premium', 'classic',
    'fit', 'cotton', 'polyester', 'blend', 'print', 'printed', 'design',
    'apparel', 'clothing', 'wear', 'fashion', 'style',
})

JUNK_WORDS = frozenset({
    'amp', 'nbsp', 'thy', 'co', 'stuff', 'vibes', 'things', 'item',
    'items', 'product', 'products', 'brand', 'brands', 'official',
    'licensed', 'trademark', 'registered', 'copyright', 'rights',
    'reserved', 'inc', 'llc', 'ltd', 'corp',
})

FUNCTION_WORDS = frozenset({
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'of', 'by', 'from', 'up', 'out',
    'if', 'or', 'as', 'it', 'so', 'no', 'not', 'but', 'an', 'a',
    'my', 'me', 'we', 'us', 'he', 'she', 'his', 'her', 'its',
    'do', 'did', 'has', 'had', 'can', 'may', 'will', 'just',
    'than', 'then', 'that', 'this', 'who', 'what', 'when', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some',
    'any', 'other', 'into', 'over', 'such', 'only', 'own', 'same',
    'very', 'too', 'also', 'back', 'even', 'still', 'about', 'get',
})

MBA_NICHE_NOUNS = frozenset({
    'cat', 'dog', 'nurse', 'teacher', 'dad', 'mom', 'grandma', 'grandpa',
    'firefighter', 'mechanic', 'trucker', 'gamer', 'baker', 'farmer',
    'fishing', 'hunting', 'camping', 'yoga', 'soccer', 'baseball',
    'basketball', 'football', 'golf', 'tennis', 'hockey', 'running',
    'gym', 'chef', 'pilot', 'doctor', 'dentist', 'lawyer', 'engineer',
    'programmer', 'artist', 'musician', 'drummer', 'guitarist', 'singer',
    'reader', 'writer', 'librarian', 'nerd', 'geek', 'introvert',
    'beer', 'wine', 'coffee', 'pizza', 'taco', 'bbq', 'bacon',
    'unicorn', 'dragon', 'dinosaur', 'shark', 'whale', 'bear',
    'wolf', 'fox', 'owl', 'bee', 'butterfly', 'turtle', 'frog',
    'horse', 'cow', 'pig', 'chicken', 'duck', 'bird', 'fish',
    'panda', 'sloth', 'otter', 'penguin', 'flamingo', 'corgi',
    'pug', 'dachshund', 'labrador', 'husky', 'bulldog',
    'bus', 'truck', 'car', 'boat', 'plane', 'train',
    'math', 'science', 'art', 'music', 'gym', 'reading',
    'sister', 'brother', 'aunt', 'uncle', 'cousin', 'wife', 'husband',
    'son', 'daughter', 'baby', 'toddler', 'kid',
})

MBA_THEME_WORDS = frozenset({
    'funny', 'sarcastic', 'vintage', 'retro', 'cute', 'kawaii',
    'patriotic', 'christmas', 'halloween', 'birthday', 'retirement',
    'graduation', 'anniversary', 'valentines', 'easter', 'thanksgiving',
    'summer', 'winter', 'spring', 'autumn', 'spooky', 'scary',
    'cool', 'awesome', 'epic', 'legend', 'legendary', 'classic',
    'old', 'school', 'proud', 'love', 'heart', 'peace',
    'humor', 'humorous', 'joke', 'pun', 'punny', 'witty', 'clever',
    'inspirational', 'motivational', 'positive', 'happy', 'blessed',
    'grateful', 'thankful', 'gift', 'present', 'surprise',
    'matching', 'couples', 'family', 'squad', 'crew', 'team',
    'custom', 'personalized', 'name', 'monogram',
})

# Exception list for plural stemming (words that should NOT be stemmed)
PLURAL_EXCEPTIONS = frozenset({
    'bus', 'dress', 'atlas', 'plus', 'canvas', 'stress', 'boss',
    'class', 'glass', 'grass', 'cross', 'loss', 'miss', 'kiss',
    'less', 'mess', 'pass', 'press', 'guess', 'access', 'success',
    'process', 'address', 'express', 'progress', 'congress',
    'christmas', 'texas', 'kansas', 'bonus', 'focus', 'virus',
    'status', 'campus', 'versus', 'genius', 'series', 'species',
})


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize_text(text):
    """Normalize text: lowercase, unescape HTML, remove parens, special chars except hyphens."""
    if not text:
        return ''
    text = text.lower()
    text = html.unescape(text)
    # Remove content in parentheses
    text = re.sub(r'\([^)]*\)', '', text)
    # Remove special chars except hyphens and alphanumeric
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ---------------------------------------------------------------------------
# Tokenization
# ---------------------------------------------------------------------------

def _split_hyphens(word):
    """Split hyphenated word into compound + parts: 'cat-lover' -> ['cat-lover', 'cat', 'lover']."""
    if '-' in word:
        parts = [p for p in word.split('-') if p]
        if len(parts) > 1:
            return [word] + parts
    return [word]


def _stem_plural(word):
    """Light plural stemming: strip trailing 's'/'es' with exceptions."""
    if word in PLURAL_EXCEPTIONS:
        return word
    if len(word) <= 4:
        return word
    # -shes, -ches, -xes, -zes, -ses -> remove 'es'
    if len(word) > 5 and word.endswith('es'):
        if word[-3] in ('s', 'h', 'x', 'z'):
            # Check for -shes, -ches specifically
            if word.endswith(('shes', 'ches', 'xes', 'zes', 'ses')):
                stemmed = word[:-2]
                if len(stemmed) > 2:
                    return stemmed
    # -ies -> -y (puppies -> puppy)
    if word.endswith('ies') and len(word) > 4:
        return word[:-3] + 'y'
    # Generic trailing 's'
    if word.endswith('s') and not word.endswith('ss'):
        return word[:-1]
    return word


def tokenize(text):
    """Tokenize normalized text into non-junk tokens with hyphen splitting and stemming."""
    if not text:
        return []
    words = text.split()
    tokens = []
    for word in words:
        word = word.strip('-')
        if not word or len(word) < 2:
            continue
        if word in JUNK_WORDS or word in FUNCTION_WORDS:
            continue
        expanded = _split_hyphens(word)
        for token in expanded:
            stemmed = _stem_plural(token)
            if stemmed and len(stemmed) >= 2:
                tokens.append(stemmed)
    return tokens


# ---------------------------------------------------------------------------
# Noun-likelihood heuristic
# ---------------------------------------------------------------------------

def _noun_score(word):
    """Score word for noun-likelihood. Threshold: >= 0.3 to pass."""
    score = 0.0
    # MBA-specific boosts
    if word in MBA_NICHE_NOUNS:
        score += 0.5
    if word in MBA_THEME_WORDS:
        score += 0.3
    # Length bonus
    if len(word) >= 5:
        score += 0.15
    elif len(word) >= 4:
        score += 0.1
    # Common noun suffixes
    noun_suffixes = ('er', 'or', 'ist', 'tion', 'ment', 'ness', 'ity', 'ing', 'ful')
    if any(word.endswith(s) for s in noun_suffixes):
        score += 0.2
    # Contains hyphen (compound word)
    if '-' in word:
        score += 0.15
    return score


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

def filter_short_tail(tokens, doc_count=1, total_docs=1):
    """Filter tokens for short-tail (focus) keywords: apply STOPWORDS + noun heuristic."""
    filtered = []
    for token in tokens:
        if token in STOPWORDS:
            continue
        if _noun_score(token) < 0.3:
            continue
        filtered.append(token)
    return filtered


def filter_long_tail(tokens):
    """Filter tokens for long-tail keywords: only remove JUNK_WORDS (STOPWORDS allowed)."""
    return [t for t in tokens if t not in JUNK_WORDS]


# ---------------------------------------------------------------------------
# N-gram building
# ---------------------------------------------------------------------------

def _build_ngrams(tokens, n):
    """Build n-grams from token list."""
    return [' '.join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


# ---------------------------------------------------------------------------
# Generic word filter
# ---------------------------------------------------------------------------

def _filter_generic(token_counts, total_products):
    """Remove tokens appearing in >= 80% of products (too generic)."""
    if total_products < 5:
        return token_counts
    threshold = total_products * 0.8
    return {k: v for k, v in token_counts.items() if v < threshold}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_keywords(products, keyword_text=''):
    """Extract short-tail + long-tail keywords from product data.

    Args:
        products: list of dicts with keys: title, brand, bullet_1, bullet_2, description (all nullable)
        keyword_text: search keyword string (for context)

    Returns:
        dict with:
            per_product: list of {product_idx, short_tail: [...], long_tail: [...]}
            global_top_focus: list of {keyword, frequency} (top 50, freq > 2)
            global_top_long_tail: list of {keyword, frequency} (top 50, freq > 2)
            all_flat: comma-separated string of all keywords
    """
    if not products:
        return {
            'per_product': [],
            'global_top_focus': [],
            'global_top_long_tail': [],
            'all_flat': '',
        }

    total_products = len(products)
    global_short_tail = Counter()
    global_long_tail = Counter()
    per_product_results = []

    # Track per-product doc frequency for generic filter
    short_tail_doc_freq = Counter()
    long_tail_doc_freq = Counter()

    for idx, product in enumerate(products):
        # Collect all text fields
        texts = []
        brand_text = ''
        for field in ('title', 'bullet_1', 'bullet_2', 'description'):
            val = product.get(field)
            if val:
                texts.append(val)
        brand_val = product.get('brand')
        if brand_val:
            brand_text = brand_val
            texts.append(brand_val)

        # Single normalization pass
        combined = ' '.join(texts)
        normalized = normalize_text(combined)
        brand_normalized = normalize_text(brand_text)

        # Tokenize
        all_tokens = tokenize(normalized)
        tokenize(brand_normalized)  # reserved for future brand-separation logic

        # Short-tail: single tokens
        short_tail_tokens = filter_short_tail(all_tokens)
        # Deprioritize brand-only tokens
        product_short_tail = Counter()
        for token in short_tail_tokens:
            product_short_tail[token] += 1

        # Long-tail: 2-grams and 3-grams from filtered tokens
        long_tail_filtered = filter_long_tail(all_tokens)
        bigrams = _build_ngrams(long_tail_filtered, 2)
        trigrams = _build_ngrams(long_tail_filtered, 3)
        # Keep only n-grams containing at least 1 noun-like token
        all_ngrams = [
            ng for ng in bigrams + trigrams
            if any(_noun_score(t) >= 0.3 for t in ng.split())
        ]
        product_long_tail = Counter(all_ngrams)

        # Track doc frequency
        for token in set(product_short_tail.keys()):
            short_tail_doc_freq[token] += 1
        for token in set(product_long_tail.keys()):
            long_tail_doc_freq[token] += 1

        # Accumulate global counts
        global_short_tail.update(product_short_tail)
        global_long_tail.update(product_long_tail)

        per_product_results.append({
            'product_idx': idx,
            'short_tail': [k for k, _ in product_short_tail.most_common(30)],
            'long_tail': [k for k, _ in product_long_tail.most_common(30)],
        })

    # Filter generic words
    global_short_tail_filtered = _filter_generic(
        dict(global_short_tail), total_products,
    )
    global_long_tail_filtered = _filter_generic(
        dict(global_long_tail), total_products,
    )

    # Apply doc frequency filter for short-tail
    global_short_tail_filtered = {
        k: v for k, v in global_short_tail_filtered.items()
        if short_tail_doc_freq.get(k, 0) < total_products * 0.8 or total_products < 5
    }

    # Top 50, frequency > 2
    top_focus = sorted(
        [{'keyword': k, 'frequency': v} for k, v in global_short_tail_filtered.items() if v > 2],
        key=lambda x: x['frequency'],
        reverse=True,
    )[:50]

    top_long_tail = sorted(
        [{'keyword': k, 'frequency': v} for k, v in global_long_tail_filtered.items() if v > 2],
        key=lambda x: x['frequency'],
        reverse=True,
    )[:50]

    # All flat
    all_keywords = set(global_short_tail_filtered.keys()) | set(global_long_tail_filtered.keys())
    all_flat = ', '.join(sorted(all_keywords))

    return {
        'per_product': per_product_results,
        'global_top_focus': top_focus,
        'global_top_long_tail': top_long_tail,
        'all_flat': all_flat,
    }
