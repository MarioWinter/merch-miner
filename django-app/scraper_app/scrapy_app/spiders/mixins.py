"""Shared extraction logic for Amazon product detail and search pages."""

import json
import re
from urllib.parse import quote_plus, urljoin

import scrapy

from scraper_app.scrapy_app.items import AmazonProductItem, ScrapeErrorItem
from scraper_app.selectors import get_base_url, get_selectors


BOILERPLATE_PHRASES = [
    'lightweight, classic fit',
    'double-needle sleeve',
    'solid colors:',
    'pull on closure',
    'machine wash',
    'imported',
]


class ProductDetailMixin:
    """Mixin providing parse_product_data for Amazon detail pages.

    Expects spider to have self.logger available (standard in scrapy.Spider).
    """

    def parse_product_data(self, response):
        marketplace = response.meta.get('marketplace', 'amazon_com')
        keyword = response.meta.get('keyword')
        is_sponsored = response.meta.get('is_sponsored', False)
        meta_asin = response.meta.get('asin')
        retry_count = response.meta.get('retry_count', 0)

        # --- Sorry/404 page detection (BEFORE selector checks) ---
        # Amazon serves HTTP 200 for deleted ASINs with a generic error page
        # featuring 'Dogs of Amazon'. The /dogsofamazon link is the most
        # reliable signature — same across marketplaces, even when localized.
        # Yield as 'product_unavailable' so the pipeline can flag the existing
        # AmazonProduct row instead of triggering a 3x retry on a dead URL.
        if self._is_product_unavailable_page(response):
            self.logger.info(
                "Amazon Sorry-page detected on %s (asin=%s)", response.url, meta_asin,
            )
            yield ScrapeErrorItem(
                failed_selector='product_unavailable',
                url=response.url,
                marketplace=marketplace,
                response_status=response.status,
                error_message=(
                    f"Amazon returned Sorry-page (deleted product) for ASIN {meta_asin or 'unknown'}"
                ),
            )
            return

        selectors = get_selectors(marketplace)
        detail = selectors['detail']

        # --- Title ---
        title = (response.css(detail['title']).get('') or '').strip() or None

        # --- ASIN from URL ---
        asin = meta_asin
        if not asin:
            asin = self._extract_asin_from_url(response.url)

        # --- Price ---
        price = self._extract_price(response, detail)

        # --- Stars ---
        stars = self._extract_stars(response, detail)

        # --- Rating count ---
        rating_count = self._extract_rating_count(response, detail)

        # --- Feature bullets ---
        raw_bullets = []
        bullet_selectors = detail['feature_bullets']
        if isinstance(bullet_selectors, str):
            bullet_selectors = [bullet_selectors]
        for sel in bullet_selectors:
            raw_bullets = [b.strip() for b in response.css(sel).getall() if b.strip()]
            if raw_bullets:
                break
        real_bullets = [
            b for b in raw_bullets
            if not any(phrase in b.lower() for phrase in BOILERPLATE_PHRASES)
        ]
        bullet_1 = real_bullets[0] if len(real_bullets) > 0 else ''
        bullet_2 = real_bullets[1] if len(real_bullets) > 1 else ''

        # --- BSR ---
        bsr, bsr_categories = self._extract_bsr(response, detail)
        category = bsr_categories[0]['category'] if bsr_categories else None

        # --- Brand ---
        brand = self._extract_brand(response, detail)

        # --- Images ---
        image_gallery = self._extract_images(response, detail)
        thumbnail_url = image_gallery[0] if image_gallery else None

        # --- Variants ---
        variants = self._extract_variants(response, detail)

        # --- Description ---
        description = None
        desc_selectors = detail['description']
        if isinstance(desc_selectors, str):
            desc_selectors = [desc_selectors]
        for sel in desc_selectors:
            desc_text = (response.css(sel).get('') or '').strip()
            if desc_text:
                description = desc_text
                break

        # --- Date First Available ---
        listed_date = self._extract_date_first_available(response, detail)

        # --- Critical selector checks (BSR is non-critical — many non-apparel products lack it) ---
        critical_fields = {'title': title, 'asin': asin}
        if bsr is None:
            self.logger.info("BSR missing on %s (non-apparel product?)", response.url)
        for field_name, value in critical_fields.items():
            if value is None or value == '':
                if retry_count < 3:
                    self.logger.warning(
                        "Selector '%s' returned empty on %s (attempt %d/3)",
                        field_name, response.url, retry_count + 1,
                    )
                    meta_copy = dict(response.meta)
                    meta_copy['retry_count'] = retry_count + 1
                    yield response.request.replace(
                        dont_filter=True, meta=meta_copy,
                    )
                    return
                else:
                    self.logger.error(
                        "Selector '%s' failed after 3 retries on %s (marketplace=%s, status=%s)",
                        field_name, response.url, marketplace, response.status,
                    )
                    yield ScrapeErrorItem(
                        failed_selector=field_name,
                        url=response.url,
                        marketplace=marketplace,
                        response_status=response.status,
                        error_message=(
                            f"Selector '{field_name}' returned empty after 3 retries"
                        ),
                    )
                    return

        # --- Non-critical missing fields (info only) ---
        if price is None:
            self.logger.info("Price missing on %s", response.url)
        if stars is None:
            self.logger.info("Stars rating missing on %s", response.url)
        if not bullet_1:
            self.logger.info("Feature bullets missing on %s", response.url)

        yield AmazonProductItem(
            asin=asin,
            marketplace=marketplace,
            title=title,
            brand=brand,
            bsr=bsr,
            bsr_categories=bsr_categories,
            category=category,
            subcategory=None,
            price=price,
            rating=stars,
            reviews_count=rating_count,
            listed_date=listed_date,
            product_type=self._detect_product_type(title),
            thumbnail_url=thumbnail_url,
            product_url=response.url,
            seller_name=None,
            bullet_1=bullet_1,
            bullet_2=bullet_2,
            description=description,
            variants=variants,
            image_gallery=image_gallery,
            keyword=keyword,
            is_sponsored=is_sponsored,
        )

    # --- Helper methods ---

    @staticmethod
    def _is_product_unavailable_page(response) -> bool:
        """Return True if Amazon returned the 'Sorry' / Dogs-of-Amazon error page.

        The /dogsofamazon link is rendered only on Amazon's generic 'product not
        found' page and is identical across marketplaces, so we use it as the
        primary signature. Bytes comparison avoids the cost of decoding the body.
        """
        return b'/dogsofamazon' in response.body

    @staticmethod
    def _extract_asin_from_url(url):
        """Extract ASIN from Amazon product URL."""
        if '/dp/' in url:
            return url.split('/dp/')[-1].split('/')[0].split('?')[0]
        parts = url.rstrip('/').split('/')
        if len(parts) > 3:
            return parts[3]
        return None

    @staticmethod
    def _extract_price(response, detail):
        """Extract price from detail page, with fallback."""
        whole = (response.css(detail['price_whole']).get('') or '').strip().rstrip('.')
        fraction = (response.css(detail['price_fraction']).get('') or '').strip()
        if whole:
            try:
                return float(f"{whole}.{fraction}" if fraction else whole)
            except ValueError:
                pass
        # Fallback
        fallback = (response.css(detail['price_fallback']).get('') or '').strip()
        if fallback:
            cleaned = re.sub(r'[^\d.]', '', fallback)
            try:
                return float(cleaned)
            except ValueError:
                pass
        return None

    @staticmethod
    def _extract_stars(response, detail):
        """Extract star rating, trying each fallback selector."""
        for selector in detail['stars']:
            text = (response.css(selector).get('') or '').strip()
            if text:
                match = re.search(r'([\d.]+)', text)
                if match:
                    try:
                        return float(match.group(1))
                    except ValueError:
                        pass
        return None

    @staticmethod
    def _extract_rating_count(response, detail):
        """Extract review/rating count as integer.

        Tries multiple selectors in order:
        1. #acrCustomerReviewText aria-label  ("14 Reviews")
        2. #acrCustomerReviewText text         ("(14)")
        3. span[data-hook=total-review-count]  ("14 global ratings")
        4. div[data-hook=total-review-count]   (legacy fallback)

        Returns first successfully parsed integer, or None.
        """
        selectors = detail['rating_count']
        if isinstance(selectors, str):
            selectors = [selectors]
        for selector in selectors:
            text = (response.css(selector).get('') or '').strip()
            if text:
                cleaned = re.sub(r'[^\d]', '', text)
                if cleaned:
                    return int(cleaned)
        return None

    @staticmethod
    def _extract_bsr(response, detail):
        """Extract BSR categories list and primary (lowest) BSR rank.

        Tries 4 Amazon BSR formats:
        1. ul.zg_hrsr — sidebar ranking list (apparel/fashion)
        2. Any table row with "Best Sellers Rank" header — covers both
           #productDetails_detailBullets_sections1 and voyager-ns-desktop-table
        3. #detailBullets_feature_div — detail bullets section
        4. Raw text regex as last resort
        """
        bsr_categories = []

        # --- Format 1: ul.zg_hrsr (sidebar/inline list) ---
        # First: extract main category from parent text BEFORE the ul.zg_hrsr
        # HTML: "#1,316,741 in Clothing, Shoes & Jewelry (See Top 100...)" <ul class="zg_hrsr">...</ul>
        zg_parent = response.css('ul.zg_hrsr')
        if zg_parent:
            parent_el = zg_parent[0].xpath('..')
            if parent_el:
                parent_texts = parent_el.css('::text').getall()
                parent_text = ' '.join(t.strip() for t in parent_texts if t.strip())
                # Extract main category: "#N in CategoryName (See Top 100..."
                main_match = re.search(r'#([\d,]+)\s+in\s+([^()\n]+?)(?:\s*\(|$)', parent_text)
                if main_match:
                    rank = int(main_match.group(1).replace(',', ''))
                    cat_name = main_match.group(2).strip()
                    if cat_name:
                        bsr_categories.append({
                            'rank': rank,
                            'category': cat_name,
                            'category_url': '',
                        })

        # Then: extract subcategories from ul.zg_hrsr li items
        bsr_items = response.css(detail['bsr_list'])
        for item in bsr_items:
            texts = item.css('::text').getall()
            full_text = ''.join(texts).strip()
            rank_match = re.search(r'#([\d,]+)', full_text)
            if rank_match:
                rank = int(rank_match.group(1).replace(',', ''))
                # Extract category name from "in CategoryName" text
                in_match = re.search(r'in\s+(.+?)$', full_text)
                if in_match:
                    cat_name = in_match.group(1).strip()
                else:
                    cat_link = item.css('a')
                    cat_name = (cat_link.css('::text').get('') or '').strip()
                cat_url = ''
                for a in item.css('a'):
                    link_text = (a.css('::text').get('') or '').strip()
                    if link_text and not link_text.startswith('See Top 100'):
                        cat_url = a.attrib.get('href', '')
                        break
                if cat_name and not any(c['category'] == cat_name for c in bsr_categories):
                    bsr_categories.append({
                        'rank': rank,
                        'category': cat_name,
                        'category_url': cat_url,
                    })

        # --- Format 2: Product Details table (any table with BSR row) ---
        # Catches both #productDetails_detailBullets_sections1 and
        # table.a-keyvalue.voyager-ns-desktop-table formats.
        if not bsr_categories:
            for row in response.css('table tr'):
                header = ' '.join(row.css('th::text').getall()).strip().lower()
                if 'best sellers rank' not in header and 'ranking' not in header:
                    continue
                value_cell = row.css('td')
                if not value_cell:
                    continue

                # Try per-<li> extraction first (voyager table with ul inside td)
                li_items = value_cell.css('ul li span.a-list-item')
                if li_items:
                    for li in li_items:
                        texts = li.css('::text').getall()
                        full_text = ''.join(texts).strip()
                        rank_match = re.search(r'#([\d,]+)', full_text)
                        if rank_match:
                            rank = int(rank_match.group(1).replace(',', ''))
                            # Extract category name from "in CategoryName" text
                            in_match = re.search(r'in\s+(.+?)(?:\s*\(|$)', full_text)
                            if in_match:
                                cat_name = in_match.group(1).strip()
                            else:
                                # Fallback: use the first non-"See Top 100" link text
                                cat_name = ''
                                for a in li.css('a'):
                                    link_text = (a.css('::text').get('') or '').strip()
                                    if link_text and not link_text.startswith('See Top 100'):
                                        cat_name = link_text
                                        break
                            # Get URL from non-"See Top 100" link if available
                            cat_url = ''
                            for a in li.css('a'):
                                href = a.attrib.get('href', '')
                                link_text = (a.css('::text').get('') or '').strip()
                                if href and not link_text.startswith('See Top 100'):
                                    cat_url = href
                                    break
                            if cat_name:
                                bsr_categories.append({
                                    'rank': rank,
                                    'category': cat_name,
                                    'category_url': cat_url,
                                })
                else:
                    # Fallback: flat text parsing (original productDetails format)
                    cell_texts = value_cell.css('::text').getall()
                    cell_text = ' '.join(t.strip() for t in cell_texts)
                    for match in re.finditer(r'#([\d,]+)\s+in\s+([^()\n]+?)(?:\s*\(|$)', cell_text):
                        rank = int(match.group(1).replace(',', ''))
                        cat_name = match.group(2).strip()
                        bsr_categories.append({
                            'rank': rank,
                            'category': cat_name,
                            'category_url': '',
                        })
                    # Sub-ranks in nested spans
                    for link in value_cell.css('a'):
                        link_text = (link.css('::text').get('') or '').strip()
                        link_href = link.attrib.get('href', '')
                        if link_text and not any(c['category'] == link_text for c in bsr_categories):
                            rank_pattern = re.search(
                                r'#([\d,]+)\s+in\s+' + re.escape(link_text),
                                cell_text,
                            )
                            if rank_pattern:
                                rank = int(rank_pattern.group(1).replace(',', ''))
                                bsr_categories.append({
                                    'rank': rank,
                                    'category': link_text,
                                    'category_url': link_href,
                                })
                break

        # --- Format 3: Detail Bullets wrapper ---
        # Handles both #detailBullets_feature_div and inline BSR with nested ul.zg_hrsr
        if not bsr_categories:
            # Try the detail bullets section
            bsr_containers = response.css('#detailBullets_feature_div li')
            for bullet in bsr_containers:
                bullet_text = ' '.join(bullet.css('::text').getall())
                if 'best sellers rank' not in bullet_text.lower() and 'ranking' not in bullet_text.lower():
                    continue
                # Parse ALL "#N in Category" patterns from the full text
                for match in re.finditer(r'#([\d,]+)\s+in\s+([^()\n]+?)(?:\s*\(|$)', bullet_text):
                    rank = int(match.group(1).replace(',', ''))
                    cat_name = match.group(2).strip()
                    if cat_name and not any(c['category'] == cat_name for c in bsr_categories):
                        # Find URL for this category from links
                        cat_url = ''
                        for link in bullet.css('a'):
                            link_text = (link.css('::text').get('') or '').strip()
                            if link_text and not link_text.startswith('See Top 100'):
                                if link_text == cat_name:
                                    cat_url = link.attrib.get('href', '')
                                    break
                        bsr_categories.append({
                            'rank': rank,
                            'category': cat_name,
                            'category_url': cat_url,
                        })
                break

        # --- Format 4: Raw text search as last resort ---
        if not bsr_categories:
            page_text = response.text
            bsr_matches = re.finditer(r'#([\d,]+)\s+in\s+([A-Z][^<\n(]{3,50})(?:\s*\(|<)', page_text)
            for match in bsr_matches:
                rank = int(match.group(1).replace(',', ''))
                cat_name = match.group(2).strip()
                if rank < 10_000_000 and not any(c['rank'] == rank for c in bsr_categories):
                    bsr_categories.append({
                        'rank': rank,
                        'category': cat_name,
                        'category_url': '',
                    })

        # Mark exactly one entry as the "main" department BSR — the rank
        # Amazon shows on the page top (e.g. "#5,932,252 in Clothing, Shoes
        # & Jewelry"). Selection heuristic, in priority order:
        #
        # 1) The first entry was prepended by Format 1 from the *parent text*
        #    of ul.zg_hrsr — this is structurally the department rank on
        #    apparel pages. Trust it absolutely if Format 1 fired.
        # 2) Otherwise (Formats 2/3/4): the rank with the largest value, on
        #    the empirical assumption that the parent department always has
        #    more competing products than any sub-category.
        # 3) Tiebreaker for #2: prefer entries whose category text contains
        #    one of the known amazon.com department roots (last-resort name
        #    match — only amazon_com is in scope per 2026-05-06 user spec).
        #
        # Result: exactly one is_main=True; bsr field = that rank.
        for c in bsr_categories:
            c['is_main'] = False
        main_idx = ProductDetailMixin._select_main_bsr_index(
            bsr_categories, response,
        )
        if main_idx is not None:
            bsr_categories[main_idx]['is_main'] = True
            bsr = bsr_categories[main_idx]['rank']
        else:
            bsr = None
        return bsr, bsr_categories

    # Department roots used as last-resort tiebreaker (amazon_com scope).
    _US_DEPT_ROOTS = (
        'Clothing, Shoes & Jewelry',
        'Toys & Games',
        'Home & Kitchen',
        'Health & Household',
        'Beauty & Personal Care',
        'Sports & Outdoors',
    )

    @staticmethod
    def _select_main_bsr_index(bsr_categories, response):
        """Return the index of the entry that should be treated as the main
        department BSR, or None if bsr_categories is empty.
        """
        if not bsr_categories:
            return None
        # Signal A: Format 1 fired — its first entry was extracted from the
        # parent text *outside* ul.zg_hrsr, which is the department rank.
        # Detect by checking the page actually has a ul.zg_hrsr block AND
        # the first entry is NOT one of the typical sub-categories Format 1
        # appends after the parent (Format 1 always prepends parent first).
        has_zg_hrsr = bool(response.css('ul.zg_hrsr'))
        first_cat = (bsr_categories[0].get('category') or '').strip()
        first_is_dept_root = any(
            root.lower() in first_cat.lower()
            for root in ProductDetailMixin._US_DEPT_ROOTS
        )
        if has_zg_hrsr and first_is_dept_root:
            return 0

        # Signal B: explicit name match — first entry whose category text
        # contains a known department root, regardless of order.
        for i, c in enumerate(bsr_categories):
            cat = (c.get('category') or '').strip()
            if any(root.lower() in cat.lower() for root in ProductDetailMixin._US_DEPT_ROOTS):
                return i

        # Signal C: highest rank wins (department has the most competition).
        return max(
            range(len(bsr_categories)),
            key=lambda i: bsr_categories[i].get('rank', 0),
        )

    @staticmethod
    def _extract_brand(response, detail):
        """Extract brand name, trying each fallback selector."""
        for selector in detail['brand']:
            text = (response.css(selector).get('') or '').strip()
            if text:
                # Strip common prefixes
                text = re.sub(r'^Brand:\s*', '', text, flags=re.IGNORECASE)
                text = re.sub(r'^Visit the\s+', '', text, flags=re.IGNORECASE)
                text = re.sub(r'\s+Store$', '', text, flags=re.IGNORECASE)
                return text.strip() or None
        return None

    @staticmethod
    def _extract_images(response, detail):
        """Extract image gallery via regex on page source."""
        regex = detail.get('images_regex', '')
        if regex:
            match = re.search(regex, response.text)
            if match:
                try:
                    images_data = json.loads(match.group(1))
                    return [
                        img.get('hiRes') or img.get('large') or img.get('thumb', '')
                        for img in images_data
                        if isinstance(img, dict)
                    ]
                except (json.JSONDecodeError, IndexError):
                    pass
        return []

    @staticmethod
    def _extract_date_first_available(response, detail):
        """Extract 'Date First Available' from product details.

        Tries:
        1. Product Details table (#productDetails_detailBullets_sections1 tr)
        2. Detail Bullets wrapper (#detailBullets_feature_div li)
        3. Raw text regex as fallback
        """
        from datetime import datetime

        date_text = None

        # Format 1: Product Details table
        table_sel = detail.get('date_first_available', '')
        if table_sel:
            for row in response.css(table_sel):
                header = ' '.join(row.css('th::text').getall()).strip().lower()
                if 'date first available' in header:
                    date_text = ' '.join(row.css('td::text').getall()).strip()
                    break

        # Format 2: Detail Bullets
        if not date_text:
            bullets_sel = detail.get('date_first_available_bullets', '')
            if bullets_sel:
                for li in response.css(bullets_sel):
                    text = ' '.join(li.css('::text').getall())
                    if 'date first available' in text.lower():
                        # Text after the colon
                        parts = text.split(':')
                        if len(parts) >= 2:
                            date_text = parts[-1].strip()
                        break

        # Format 3: Raw regex
        if not date_text:
            match = re.search(
                r'Date First Available[^:]*:\s*</span>\s*<span[^>]*>([^<]+)</span>',
                response.text,
            )
            if match:
                date_text = match.group(1).strip()

        if not date_text:
            return None

        # Clean up unicode markers
        date_text = date_text.replace('\u200f', '').replace('\u200e', '').strip()

        # Parse date — Amazon uses formats like "February 23, 2026" or "23 February 2026"
        for fmt in ('%B %d, %Y', '%d %B %Y', '%b %d, %Y', '%d %b %Y'):
            try:
                return datetime.strptime(date_text, fmt).date()
            except ValueError:
                continue

        return None

    @staticmethod
    def _detect_product_type(title):
        """Detect MBA product type from title suffix.

        Amazon MBA titles always end with the product type, e.g.:
        - "Funny Bus Driver T-Shirt"
        - "Cool Bus Driver Tank Top"
        - "School Bus Zip Hoodie"
        """
        if not title:
            return 'other'

        title_lower = title.lower().strip()

        # Order matters — check multi-word types first
        type_mapping = [
            ('zip hoodie', 'zip_hoodie'),
            ('long sleeve', 'long_sleeve'),
            ('tank top', 'tank_top'),
            ('t-shirt', 't_shirt'),
            ('tee shirt', 't_shirt'),
            ('tee', 't_shirt'),
            ('hoodie', 'hoodie'),
            ('pullover', 'sweatshirt'),
            ('sweatshirt', 'sweatshirt'),
        ]

        for suffix, product_type in type_mapping:
            if title_lower.endswith(suffix):
                return product_type

        return 'other'

    @staticmethod
    def _extract_variants(response, detail):
        """Extract variant data via regex on page source."""
        regex = detail.get('variants_regex', '')
        if regex:
            match = re.search(regex, response.text)
            if match:
                try:
                    return json.loads(match.group(1))
                except (json.JSONDecodeError, IndexError):
                    pass
        return {}


class SearchPageMixin:
    """Mixin providing shared search page logic for Amazon search spiders.

    Expects spider to have: self.keyword, self.marketplace, self.job_id,
    self.max_pages, self.search_index, self.seller_filter, self.logger.
    """

    def _build_search_url(self, page=1):
        """Build Amazon search URL with keyword + product_type_filter params."""
        base_url = get_base_url(self.marketplace)

        # When keyword is empty (browse-node-only scrape), omit &k= param
        if self.keyword:
            search_url = f"{base_url}/s?k={quote_plus(self.keyword)}&page={page}"
        else:
            search_url = f"{base_url}/s?page={page}"

        if self.search_index:
            search_url += f"&i={self.search_index}"

        # Assemble single &rh= parameter from seller_filter (p_6) +
        # extra_rh_filters (arbitrary key:value pairs e.g. p_76, p_n_g-..., n).
        # Amazon expects ONE rh= with comma-separated key:value pairs.
        rh_pairs = []
        if self.seller_filter:
            rh_pairs.append(f"p_6:{self.seller_filter}")
        extra_rh_filters = getattr(self, "extra_rh_filters", None)
        if extra_rh_filters:
            # Allow either a dict (preferred) or a JSON string (CLI-passed)
            if isinstance(extra_rh_filters, str):
                try:
                    extra_rh_filters = json.loads(extra_rh_filters)
                except (json.JSONDecodeError, TypeError):
                    logger_obj = getattr(self, 'logger', None)
                    if logger_obj is not None:
                        logger_obj.warning(
                            "extra_rh_filters could not be parsed as JSON: %r",
                            extra_rh_filters,
                        )
                    extra_rh_filters = {}
            if isinstance(extra_rh_filters, dict):
                for key, value in extra_rh_filters.items():
                    # Skip duplicate p_6 (seller_filter handles it)
                    if key == "p_6" and self.seller_filter:
                        continue
                    rh_pairs.append(f"{key}:{value}")
        if rh_pairs:
            search_url += "&rh=" + quote_plus(",".join(rh_pairs), safe=":,-")

        sort_by = getattr(self, "sort_by", None)
        if sort_by:
            search_url += f"&s={sort_by}"

        price_min = getattr(self, "price_min", None)
        if price_min is not None and price_min != "":
            search_url += f"&low-price={price_min}"

        price_max = getattr(self, "price_max", None)
        if price_max is not None and price_max != "":
            search_url += f"&high-price={price_max}"

        browse_node = getattr(self, "browse_node", None)
        if browse_node:
            search_url += f"&bbn={browse_node}"

        return search_url

    def _increment_pages_done(self, page=None):
        """Increment pages_done on the ScrapeJob and stamp page freshness on
        the linked ProductSearchCache(s).

        `page` is the 1-indexed search-result page number that was just
        scraped. When provided, we record an ISO-8601 timestamp in
        `ProductSearchCache.pages_scraped_at` keyed by `str(page)` so the
        next Live Research trigger can skip pages younger than 24h.
        """
        if not self.job_id:
            return
        try:
            import os

            import django

            os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
            django.setup()
            from django.db.models import F
            from django.utils import timezone as dj_tz

            from scraper_app.models import ProductSearchCache, ScrapeJob

            ScrapeJob.objects.filter(id=self.job_id).update(
                pages_done=F("pages_done") + 1,
            )

            if page is not None:
                page_key = str(int(page))
                now_iso = dj_tz.now().isoformat()
                caches = ProductSearchCache.objects.filter(scrape_job_id=self.job_id)
                for cache in caches:
                    pages_map = dict(cache.pages_scraped_at or {})
                    pages_map[page_key] = now_iso
                    cache.pages_scraped_at = pages_map
                    cache.save(update_fields=["pages_scraped_at"])
        except Exception:
            self.logger.debug("Failed to increment pages_done for job %s", self.job_id)

    def _parse_search_page(self, response):
        """Iterate product containers on search page, handle pagination.

        Yields (product_selector, is_sponsored) tuples for each product found.
        Returns list of next-page Request objects for pagination.
        """
        marketplace = response.meta["marketplace"]
        keyword = response.meta["keyword"]
        page = response.meta["page"]

        selectors = get_selectors(marketplace)
        search_sel = selectors["search"]

        products = response.css(search_sel["product_container"])
        self.logger.info(
            "Page %d: found %d products for '%s'",
            page,
            len(products),
            keyword,
        )

        self._increment_pages_done(page=page)

        return products, search_sel, page

    def _extract_search_card_data(self, product, search_sel, marketplace):
        """Extract ASIN, title, brand, price, URL, thumbnail, sponsored from search result card.

        Returns dict with extracted data or None if no URL found.
        """
        base_url = get_base_url(marketplace)

        # Extract URL using fallback list
        product_url = None
        for url_selector in search_sel["url"]:
            product_url = product.css(url_selector).get()
            if product_url:
                break

        if not product_url:
            return None

        # Build absolute URL, strip query params
        absolute_url = urljoin(base_url, product_url).split("?")[0]

        # Extract ASIN from URL
        asin = None
        if "/dp/" in absolute_url:
            asin = absolute_url.split("/dp/")[-1].split("/")[0]
        else:
            parts = absolute_url.rstrip("/").split("/")
            if len(parts) > 3:
                asin = parts[3]

        # Check if sponsored
        is_sponsored = search_sel["sponsored_indicator"] in product_url

        # Title
        title = None
        title_selectors = search_sel["title"]
        if isinstance(title_selectors, str):
            title_selectors = [title_selectors]
        for sel in title_selectors:
            title = product.css(sel).get()
            if title:
                title = title.strip()
                break

        # Price
        price = None
        price_whole = (product.css(search_sel["price_whole"]).get('') or '').strip().rstrip('.')
        price_fraction = (product.css(search_sel["price_fraction"]).get('') or '').strip()
        if price_whole:
            try:
                price = float(f"{price_whole}.{price_fraction}" if price_fraction else price_whole)
            except ValueError:
                pass

        # Rating
        rating = None
        rating_text = (product.css(search_sel["rating"]).get('') or '').strip()
        if rating_text:
            match = re.search(r'([\d.]+)', rating_text)
            if match:
                try:
                    rating = float(match.group(1))
                except ValueError:
                    pass

        # Reviews count
        reviews_count = None
        reviews_text = (product.css(search_sel["rating_count"]).get('') or '').strip()
        if reviews_text:
            cleaned = re.sub(r'[^\d]', '', reviews_text)
            if cleaned:
                reviews_count = int(cleaned)

        # Brand (short name above the title link)
        brand = None
        brand_selectors = search_sel.get("brand", [])
        if isinstance(brand_selectors, str):
            brand_selectors = [brand_selectors]
        for sel in brand_selectors:
            brand = product.css(sel).get()
            if brand:
                brand = brand.strip()
                break

        # Thumbnail
        thumbnail = product.css(search_sel["thumbnail"]).get()

        return {
            'asin': asin,
            'absolute_url': absolute_url,
            'is_sponsored': is_sponsored,
            'title': title,
            'brand': brand,
            'price': price,
            'rating': rating,
            'reviews_count': reviews_count,
            'thumbnail_url': thumbnail,
        }

    def _get_pagination_requests(self, response, callback):
        """Generate pagination requests for remaining pages (only on first page)."""
        page = response.meta["page"]
        keyword = response.meta["keyword"]
        marketplace = response.meta["marketplace"]
        job_id = response.meta.get("job_id")

        start_page = getattr(self, "start_page", 1)
        if page != start_page:
            return

        selectors = get_selectors(marketplace)
        search_sel = selectors["search"]

        page_numbers = response.xpath(search_sel["pagination"]).getall()
        numeric_pages = []
        for p in page_numbers:
            try:
                numeric_pages.append(int(p.strip()))
            except ValueError:
                continue

        last_page = max(numeric_pages) if numeric_pages else start_page
        last_page = min(last_page, start_page + self.max_pages - 1)

        for next_page in range(start_page + 1, last_page + 1):
            next_url = self._build_search_url(page=next_page)
            yield scrapy.Request(
                url=next_url,
                callback=callback,
                meta={
                    "keyword": keyword,
                    "marketplace": marketplace,
                    "page": next_page,
                    "job_id": job_id,
                    "retry_count": 0,
                },
            )
