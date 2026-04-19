"""Static reference data for publish_app.

This module holds canonical Amazon Merch by Amazon (MBA) reference data that
does not need to live in the database (rarely changes, no per-workspace
variation, read-only). Per Spec PROJ-11 AC-37 (decided 2026-04-18), the MBA
garment color palette is served from a central Python constant so the
frontend does not hardcode Amazon's color list and the palette can be updated
without a frontend deploy.

Source: Amazon MBA Standard T-Shirt color palette (the ~20 staple colors
actually available on MBA product pages). Keys are lowercase snake_case.
Names mirror Amazon's display labels. Hex values are approximate matches to
the swatches shown in the MBA seller interface.
"""

MBA_COLORS: list[dict[str, str]] = [
    {"key": "black", "name": "Black", "hex": "#000000"},
    {"key": "white", "name": "White", "hex": "#FFFFFF"},
    {"key": "navy", "name": "Navy", "hex": "#0E1E3A"},
    {"key": "asphalt", "name": "Asphalt", "hex": "#363636"},
    {"key": "red", "name": "Red", "hex": "#B8262A"},
    {"key": "royal_blue", "name": "Royal Blue", "hex": "#1A56A4"},
    {"key": "kelly_green", "name": "Kelly Green", "hex": "#1D7A3B"},
    {"key": "forest_green", "name": "Forest Green", "hex": "#0F3D2E"},
    {"key": "brown", "name": "Brown", "hex": "#4A2F22"},
    {"key": "purple", "name": "Purple", "hex": "#4B2E83"},
    {"key": "pink", "name": "Pink", "hex": "#E4007C"},
    {"key": "orange", "name": "Orange", "hex": "#DD5E19"},
    {"key": "yellow", "name": "Yellow", "hex": "#F5D011"},
    {"key": "silver", "name": "Silver", "hex": "#C8CBCE"},
    {"key": "heather_grey", "name": "Heather Grey", "hex": "#9A9A9A"},
    {"key": "heather_blue", "name": "Heather Blue", "hex": "#6F8FB5"},
    {"key": "heather_navy", "name": "Heather Navy", "hex": "#2B3D5B"},
    {"key": "heather_dark_grey", "name": "Heather Dark Grey", "hex": "#4A4A4A"},
    {"key": "heather_red", "name": "Heather Red", "hex": "#A24141"},
    {"key": "cranberry", "name": "Cranberry", "hex": "#8C1A3B"},
]
