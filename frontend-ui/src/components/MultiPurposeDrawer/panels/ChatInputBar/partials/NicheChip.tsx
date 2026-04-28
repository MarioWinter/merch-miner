/**
 * PROJ-20 Phase 3.2 — atomic chip builder.
 *
 * Why a DOM builder (not a React component): the chip lives inside a
 * contenteditable subtree where the user is typing. Letting React control
 * its lifecycle creates fights with native DOM mutations (caret resets,
 * detached nodes). Build raw DOM, hand it to the editable root, and let
 * the SmartTextarea own caret + selection management.
 *
 * Markup contract (also documented for parseChipText.ts):
 *   <span
 *     contenteditable="false"
 *     data-niche-chip
 *     data-niche-id="{id}"
 *     data-niche-name="{name}"
 *     class="MM-chip"
 *   >
 *     <span class="MM-chip__label">@{name}</span>
 *     <button
 *       type="button"
 *       contenteditable="false"
 *       data-chip-remove
 *       aria-label="{removeLabel}"
 *       class="MM-chip__remove"
 *     >×</button>
 *   </span>
 */
export interface BuildChipNodeArgs {
  niche_id: string;
  niche_name: string;
  /**
   * Localised aria-label for the ✕ remove button. The caller is responsible
   * for translating it (`t('search.chatBar.removeChip')`).
   */
  removeLabel: string;
}

export const CHIP_CLASS = 'MM-chip';
export const CHIP_LABEL_CLASS = 'MM-chip__label';
export const CHIP_REMOVE_CLASS = 'MM-chip__remove';

export const buildChipNode = ({
  niche_id,
  niche_name,
  removeLabel,
}: BuildChipNodeArgs): HTMLSpanElement => {
  const root = document.createElement('span');
  root.setAttribute('contenteditable', 'false');
  root.dataset.nicheChip = '';
  root.dataset.nicheId = niche_id;
  root.dataset.nicheName = niche_name;
  root.className = CHIP_CLASS;

  const label = document.createElement('span');
  label.className = CHIP_LABEL_CLASS;
  label.textContent = `@${niche_name}`;
  root.appendChild(label);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.setAttribute('contenteditable', 'false');
  removeBtn.dataset.chipRemove = '';
  removeBtn.setAttribute('aria-label', removeLabel);
  removeBtn.className = CHIP_REMOVE_CLASS;
  removeBtn.textContent = '×';
  root.appendChild(removeBtn);

  return root;
};
