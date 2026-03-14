"""Shared extraction logic for Amazon product detail pages."""

import json
import re

from scraper_app.scrapy_app.items import AmazonProductItem, ScrapeErrorItem
from scraper_app.selectors import get_selectors, get_base_url


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
        job_id = response.meta.get('job_id')
        keyword = response.meta.get('keyword')
        is_sponsored = response.meta.get('is_sponsored', False)
        meta_asin = response.meta.get('asin')
        retry_count = response.meta.get('retry_count', 0)

        selectors = get_selectors(marketplace)
        base_url = get_base_url(marketplace)
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

        # --- Brand ---
        brand = self._extract_brand(response, detail)

        # --- Category (first BSR category) ---
        category = bsr_categories[0]['category'] if bsr_categories else None

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
        """Extract review/rating count as integer."""
        text = (response.css(detail['rating_count']).get('') or '').strip()
        if text:
            cleaned = re.sub(r'[^\d]', '', text)
            if cleaned:
                return int(cleaned)
        return None

    @staticmethod
    def _extract_bsr(response, detail):
        """Extract BSR categories list and primary (lowest) BSR rank.

        Tries 3 Amazon BSR formats:
        1. ul.zg_hrsr — sidebar ranking list (apparel/fashion)
        2. #productDetails table rows — "Best Sellers Rank" row
        3. #detailBullets_feature_div — detail bullets section
        """
        bsr_categories = []

        # --- Format 1: ul.zg_hrsr (sidebar list) ---
        bsr_items = response.css(detail['bsr_list'])
        for item in bsr_items:
            texts = item.css('::text').getall()
            full_text = ''.join(texts).strip()
            rank_match = re.search(r'#([\d,]+)', full_text)
            if rank_match:
                rank = int(rank_match.group(1).replace(',', ''))
                cat_link = item.css('a')
                cat_name = (cat_link.css('::text').get('') or '').strip()
                cat_url = cat_link.attrib.get('href', '')
                bsr_categories.append({
                    'rank': rank,
                    'category': cat_name,
                    'category_url': cat_url,
                })

        # --- Format 2: Product Details table ---
        if not bsr_categories:
            table_rows = response.css('#productDetails_detailBullets_sections1 tr')
            for row in table_rows:
                header = (row.css('th::text').get('') or '').strip().lower()
                if 'best sellers rank' in header or 'ranking' in header:
                    value_cell = row.css('td')
                    if value_cell:
                        # Main rank
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
                            # Find rank number before this link
                            prev_text = ' '.join(cell_texts)
                            rank_before = re.search(r'#([\d,]+)\s+in\s+$', prev_text)
                            if link_text and not any(c['category'] == link_text for c in bsr_categories):
                                # Try to find rank from full cell text
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

        # --- Format 3: Detail Bullets wrapper ---
        if not bsr_categories:
            bullets = response.css('#detailBullets_feature_div li')
            for bullet in bullets:
                bullet_text = ' '.join(bullet.css('::text').getall())
                if 'best sellers rank' in bullet_text.lower() or 'ranking' in bullet_text.lower():
                    for match in re.finditer(r'#([\d,]+)\s+in\s+([^()\n]+?)(?:\s*\(|$)', bullet_text):
                        rank = int(match.group(1).replace(',', ''))
                        cat_name = match.group(2).strip()
                        bsr_categories.append({
                            'rank': rank,
                            'category': cat_name,
                            'category_url': '',
                        })
                    # Also check links within the bullet
                    for link in bullet.css('a'):
                        link_text = (link.css('::text').get('') or '').strip()
                        link_href = link.attrib.get('href', '')
                        if link_text and '/bestsellers/' in link_href:
                            rank_pattern = re.search(
                                r'#([\d,]+)\s+in\s+' + re.escape(link_text),
                                bullet_text,
                            )
                            if rank_pattern and not any(c['category'] == link_text for c in bsr_categories):
                                rank = int(rank_pattern.group(1).replace(',', ''))
                                bsr_categories.append({
                                    'rank': rank,
                                    'category': link_text,
                                    'category_url': link_href,
                                })

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

        bsr = min((c['rank'] for c in bsr_categories), default=None)
        return bsr, bsr_categories

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
            ('pullover', 'pullover'),
            ('sweatshirt', 'pullover'),
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
