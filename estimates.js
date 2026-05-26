// Build a card badge: <span class="bootstrap-iso"><span class="label label-xxx" data-value="N">N</span></span>
function buildCardBadge(typeContent, text, value) {
    const wrap = document.createElement('span');
    wrap.classList.add('bootstrap-iso');
    const lbl = document.createElement('span');
    lbl.classList.add('label', typeContent);
    if (value !== undefined && !isNaN(value)) {
        lbl.setAttribute('data-value', value.toString());
    }
    lbl.textContent = text;
    wrap.appendChild(lbl);
    return wrap;
}

// Build a column-sum item: <div class="label label-xxx" style="margin:3px">N</div>
function buildSumItem(typeContent, value) {
    const el = document.createElement('div');
    el.classList.add('label', typeContent);
    el.style.margin = '3px';
    el.textContent = value;
    return el;
}

// Copy visual properties from a reference element so the extraRow tracks
// Planner's responsive card styling (padding, font-size).
function mirrorSiblingStyles(fromEl, toEl) {
    if (!fromEl) return;
    let cs = window.getComputedStyle(fromEl);

    // If the reference has no padding itself, the padding likely lives on its
    // parent container — try one level up.
    const hasPadding =
        parseFloat(cs.paddingTop) || parseFloat(cs.paddingRight) ||
        parseFloat(cs.paddingBottom) || parseFloat(cs.paddingLeft);
    const paddingSource = !hasPadding && fromEl.parentElement
        ? window.getComputedStyle(fromEl.parentElement)
        : cs;

    toEl.style.padding = paddingSource.padding ||
        (paddingSource.paddingTop + ' ' + paddingSource.paddingRight + ' ' +
         paddingSource.paddingBottom + ' ' + paddingSource.paddingLeft);

    // Font-size always comes from the sibling itself, so badges read at the
    // same size as the assignee row's text.
    toEl.style.fontSize = cs.fontSize;
}

setInterval(function () {
    const columns = document.querySelectorAll('[id^="column_"]');

    columns.forEach(function (column) {
        // Append target for the column sum — Microsoft's own test hook
        const columnBody = column.querySelector('[data-testid="task-board-column-body"]');
        if (!columnBody) return;

        const cards = column.querySelectorAll('[data-dnd-role="card"]');

        cards.forEach(function (card) {
            const cardTitle = card.getAttribute('aria-label') || '';
            if (!cardTitle) return;

            // Card root — carries the backend task ID
            const cardBody = card.querySelector('[data-id]');
            if (!cardBody) return;

            // Card's inner padded wrapper — first child of [data-id]. Holds the
            // title, bucket, checklist, and assignee sections.
            const cardInner = cardBody.firstElementChild;
            if (!cardInner) return;

            const regexp = /(\(\s*([^)]+)\s*\)|\[\s*([^\]]+)\s*]|\{\s*([^}]+)\s*})/g;
            const extraRowSpans = [];
            let matchResult;
            let i = 0;

            // Regex walks left-to-right through the title with the `g` flag, so
            // matches arrive in title order — badges naturally inherit that order.
            while (i < 20 && (matchResult = regexp.exec(cardTitle)) !== null) {
                let typeContent, matchIndex;
                if (matchResult[2] !== undefined)      { typeContent = 'label-info';    matchIndex = 2; }
                else if (matchResult[3] !== undefined) { typeContent = 'label-default'; matchIndex = 3; }
                else if (matchResult[4] !== undefined) { typeContent = 'label-success'; matchIndex = 4; }

                if (typeContent) {
                    const text = matchResult[matchIndex];
                    const value = parseFloat(text);
                    extraRowSpans.push(buildCardBadge(typeContent, text, value));
                }
                ++i;
            }

            if (extraRowSpans.length > 0) {
                // Remove any previous extraRow from this card (idempotency)
                const oldRow = cardInner.querySelector(':scope > .extraRow');
                if (oldRow) oldRow.remove();

                const extraRow = document.createElement('div');
                extraRow.classList.add('extraRow');
                extraRow.style.display = 'flex';
                extraRow.style.flexDirection = 'row';
                extraRow.style.flexWrap = 'nowrap';
                extraRow.style.gap = '6px';
                extraRowSpans.forEach((s) => extraRow.appendChild(s));

                // Append as the last row of the card's inner wrapper
                cardInner.appendChild(extraRow);

                // Mirror padding and font-size from the row immediately above
                // (assignee section) so the extraRow visually matches the rest
                // of the card responsively.
                mirrorSiblingStyles(extraRow.previousElementSibling, extraRow);
            }
        });

        // Calculate column sums — order is determined by the order in which each
        // bracket type first appears across the cards in this column, mirroring
        // the title-order convention used on each card.
        const sumByCls = {};      // cls -> { sum, has }
        const orderedClasses = []; // tracks first-seen order

        column.querySelectorAll('div.extraRow span.label').forEach(function (it) {
            // Identify which bracket type this badge represents
            let cls = null;
            if (it.classList.contains('label-default'))      cls = 'label-default';
            else if (it.classList.contains('label-info'))    cls = 'label-info';
            else if (it.classList.contains('label-success')) cls = 'label-success';
            if (!cls) return;

            if (!sumByCls[cls]) {
                sumByCls[cls] = { sum: 0, has: false };
                orderedClasses.push(cls);
            }
            const value = it.getAttribute('data-value');
            if (value) {
                sumByCls[cls].sum += parseFloat(value);
                sumByCls[cls].has = true;
            }
        });

        orderedClasses.forEach(function (cls) {
            sumByCls[cls].sum = Math.round(sumByCls[cls].sum * 100) / 100;
        });

        // Build sum display
        const sumHtml = document.createElement('div');
        sumHtml.classList.add('bootstrap-iso', 'colEstimatesPlugin');
        // Right-align the sum labels within the column header area
        sumHtml.style.display = 'flex';
        sumHtml.style.justifyContent = 'flex-end';

        orderedClasses.forEach(function (cls) {
            if (sumByCls[cls].has) {
                sumHtml.appendChild(buildSumItem(cls, sumByCls[cls].sum));
            }
        });

        // Idempotency
        const oldSum = column.querySelector('.colEstimatesPlugin');
        if (oldSum) oldSum.remove();

        // Insert as first child of the column body, above all cards
        columnBody.insertBefore(sumHtml, columnBody.firstChild);
    });
}, 3000);
