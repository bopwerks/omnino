const omnino = (() => {
const commonStyles = `
div.header { background: var(--omnino-menu-background, #eefdfd); color: var(--omnino-menu-fgcolor, black); display: grid; grid-template-columns: 17px 1fr; border-bottom: 1px solid var(--omnino-border-color, black); flex: 0 1 auto; }
div.header > nav { display: flex; flex-flow: row; overflow-x: hidden; align-items: center; font-family: Verdana; font-size: 0.8rem; }
div.header > nav > h1, h2 { font-size: 0.8rem; margin: 0 0.3rem 0 0.3rem; white-space: nowrap; }
div.header > nav > h1::after { content: var(--omnino-title, "Omnino"); }
nav > a { color: inherit; text-decoration: none; margin: 0; padding: 0.1rem 0.4rem 0.1rem 0.4rem; }
nav > a:hover { background-color: var(--omnino-link-hover-color, #C6FDFD); }
nav > a:active { background-color: var(--omnino-link-active-color, #a6FDFD); }
div.column:first-of-type { border-left: none; }
div.handle { background: var(--omnino-handle-color, #7C7ABD); user-select: none; }
div.loading { background: linear-gradient(to left, #afadee, #eefdfd 100%); }
`;

class OmninoApplication extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        this.columns = [];
        this.mouseOffset = null;
        this.minColumnWidth = 100;
        this.menu = [
            {
                title: "Newcol",
                link: this.addColumn.bind(this),
            },
        ];

        const style = document.createElement("style");
        style.textContent = `
        ${commonStyles}
        div.header { border-bottom-width: 2px; }
        div.wrapper { width: 100%; height: 100%; display: flex; flex-flow: column; }
        div.columns { flex: 1 1 auto; display: grid; background: var(--omnino-background-color, white); }
        `;
        shadow.appendChild(style);

        const wrapper = document.createElement("div");
        wrapper.classList.add("wrapper");
        {
            const header = document.createElement("div");
            header.classList.add("header");
            header.style.gridTemplateColumns = `${getScrollbarWidth()}px 1fr`;
            {
                const handle = document.createElement("div");
                handle.classList.add("handle");
                header.appendChild(handle);

                const nav = document.createElement("nav");
                {
                    const title = document.createElement("h1");
                    nav.appendChild(title);
                }
                header.appendChild(nav);
            }
            wrapper.appendChild(header);

            const columns = document.createElement("div");
            columns.classList.add("columns");
            columns.style.gridTemplateColumns = "100%";
            columns.innerHTML = `<slot></slot>`;
            wrapper.appendChild(columns);
        }
        shadow.appendChild(wrapper);
        this.setMenu(this.menu);
    }
    addColumn() {
        const lastColumnPct = (this.columns.length > 0) ? this.columns[this.columns.length-1] : 100;
        const appWidth = this.getBoundingClientRect().width;
        const lastColumnWidth = lastColumnPct * appWidth / 100;
        const minDistance = 2 * this.minColumnWidth;
        if (lastColumnWidth > minDistance) {
            const column = document.createElement("omnino-col");
            this.appendChild(column);
            // console.log(`Column %s: ${this.columns}`);
            return makeColumnProxy(column);
        }
        return null;
    }
    getMenu() {
        return this.menu.map(item => Object.assign({}, item));
    }
    setMenu(menu) {
        const nav = this.shadowRoot.querySelector("nav");
        console.assert(nav);

        // Remove 'a' tags from nav
        const links = Array.prototype.slice.call(nav.children).filter(elt => elt.nodeName === "A");
        links.forEach(link => {
            nav.removeChild(link);
        });

        // Clone the array so the user can't muck with the data, and set the new links.
        this.menu = menu.map(item => Object.assign({}, item));
        this.menu.forEach(item => {
            const elt = document.createElement("a");
            const title = item.title;
            const link = item.link;
            elt.innerText = item.title;
            if (typeof link === "string") {
                elt.setAttribute("href", item.link);
            } else if (typeof link === "function") {
                elt.setAttribute("href", "#");
                elt.addEventListener("click", () => {
                    link();
                });
            } else {
                throw new Error("Menu item link must be a URL or a function.");
            }
            nav.appendChild(elt);
        });
    }
    columnAdded() {
        const columns = this.shadowRoot.querySelector(".columns");
        console.assert(columns);
        if (this.columns.length === 0) {
            this.columns.push(100);
            const style = "100%";
            columns.style.gridTemplateColumns = style;
        } else {
            const lastColumnWidth = this.columns.pop();
            const newColumnWidth = lastColumnWidth * 0.37;
            const newLastColumnWidth = lastColumnWidth - newColumnWidth;
            this.columns.push(newLastColumnWidth);
            this.columns.push(newColumnWidth);
            this.columns[this.columns.length-1] = reduceExcept(this.columns, (a, b) => a - b, 100, this.columns.length-1);
        }
        this.updateColumns();
        this.updateColor();
    }
    updateColumns() {
        const columns = this.shadowRoot.querySelector(".columns");
        console.assert(columns);
        const style = this.columns.map(percentage => `${percentage}%`).join(' ');
        columns.style.gridTemplateColumns = style;
    }
    updateColor() {
        const columns = this.shadowRoot.querySelector(".columns");
        console.assert(columns);
        if (this.children.length === 0) {
            // Set to --omnino-background-color or default.
            const bgcolor = getComputedStyle(this).getPropertyValue("--omnino-background-color");
            columns.style.backgroundColor = (bgcolor) ? bgcolor : "white";
        } else {
            // Inherit the background color from the body, which the user sets.
            columns.style.backgroundColor = "inherit";
        }
    }
    removeColumn(i, col) {
        // If the only node, just remove the node and clear the width list.
        if (this.columns.length == 1) {
            this.columns = [];
        // If the first node, add width to the next and remove.
        } else if (i == 0) {
            const w1 = this.columns.shift();
            const w2 = this.columns.shift();
            this.columns.unshift(w1+w2);
        // Otherwise add width to the previous and remove.
        } else {
            const w1 = this.columns[i-1];
            const w2 = this.columns[i];
            this.columns.splice(i-1, 2, w1+w2);
        }
        this.removeChild(col);
        this.updateColumns();
        this.updateColor();
    }
}
customElements.define('omnino-app', OmninoApplication);

const elementIndex = (elt) => {
    let i = 0;
    for ( ; elt.previousSibling != null; elt = elt.previousSibling)
        ++i;
    return i;
}

const getScrollbarWidth = () => {
    // Creating invisible container
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll'; // forcing scrollbar to appear
    outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
    document.body.appendChild(outer);

    // Creating inner element and placing it in the container
    const inner = document.createElement('div');
    outer.appendChild(inner);

    // Calculating difference between container's full width and the child width
    const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

    // Removing temporary elements from the DOM
    outer.parentNode.removeChild(outer);
    return scrollbarWidth;
}

const clamp = (a, x, b) => {
    if (a > b) {
        return undefined;
    }
    if (b === undefined) {
        b = x;
    }
    if (x < a) {
        return a;
    } else if (x > b) {
        return b;
    } else {
        return x;
    }
};

// Move element at position i to position j.
const moveElement = (arr, i, j) => {
    const elt = arr[i];
    arr.splice(i, 1);
    arr.splice((i < j) ? j-1 : j, 0, elt);
}

const reduceFirst = (arr, predicate, combine, initial) => {
    if (arr.length === 0) {
        return null;
    }
    let sum = initial;
    let i = 0;
    let rval = arr[0];
    for ( ; i < arr.length && !predicate(sum); ++i) {
        rval = arr[i];
        sum = combine(sum, arr[i]);
    }
    return rval;
};

class OmninoColumn extends HTMLElement {
    constructor() {
        super();
        this.windows = [];
        this.ismoving = false;
        this.menu = [
            {
                title: "Newwin",
                link: this.addWindow.bind(this),
            },
            {
                title: "Delcol",
                link: this.removeColumn.bind(this),
            },
        ];
        const shadow = this.attachShadow({mode: 'open'});
        shadow.innerHTML = `
        <style>
        ${commonStyles}
        div.header { border-bottom-width: 2px; grid-template-columns: ${getScrollbarWidth()}px 1fr; }
        div.column { display: flex; flex-flow: column; height: 100%; min-width: 0; background: var(--omnino-background-color, white); }
        div.windows { flex: 1 1 auto; display: grid; min-width: 0; grid-template-rows: 100%; }
        div.handle { cursor: move; }
        :host { border-left: 2px solid var(--omnino-border-color, black); }
        :host(:first-of-type) { border-left: none; }
        </style>
        <div class="column">
            <div class="header">
                <div class="handle"></div>
                <nav></nav>
            </div>
            <div class="windows">
                <slot></slot>
            </div>
        </div>
        `;
        const omninocol = this;
        const handle = shadow.querySelector(".handle");
        handle.addEventListener("mousedown", mouseDownEvent => {
            // Compute offset of mouse from the top left of the column.
            const app = omninocol.parentElement;
            const colrect = omninocol.getBoundingClientRect();
            // The position of the mousedown event relative to the OmninoApplication.
            const mouseDownX = mouseDownEvent.clientX - eleft(app);
            // The x displacement from the top-left corner of the column to the mouse.
            const mouseOffsetX = mouseDownEvent.clientX - colrect.left;

            // Store the offset in the parent to be used by its mouseup handler.
            app.style.cursor = "move";

            const cancelMoveChild = event => {
                app.removeEventListener("mouseup", moveChild);
                app.style.cursor = "default";
                app.removeEventListener("mouseleave", cancelMoveChild);
            };
            const moveChild = mouseUpEvent => {
                // Compute the position of the mouse event relative to OmninoApplication.
                const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                const dd = mouseUpEvent.clientX - mouseDownEvent.clientX;
                const x = mouseUpEvent.clientX - rect.left - mouseOffsetX;

                const minDistance = app.minColumnWidth;
                const containerDistance = app.getBoundingClientRect().width;

                const dstchild = reduceFirst(app.children, w => w >= x, (a, b) => a + ewidth(b), 0);
                console.assert(dstchild !== null);

                const srcchild = omninocol;
                const srcleft = srcchild.previousElementSibling;
                const srcright = srcchild.nextElementSibling;
                const isResize = (dstchild === srcchild || (srcleft !== null && dstchild === srcleft));
                const sizes = app.columns;
                
                if (isResize) {
                    resize(srcchild, app, x, eleft, ewidth, minDistance, containerDistance, dd, sizes);
                } else {
                    exchange(srcchild, dstchild, x, app, eleft, ewidth, minDistance, containerDistance, sizes);
                }
                app.updateColumns();
                cancelMoveChild(mouseUpEvent);
            };
            app.addEventListener("mouseup", moveChild);
            app.addEventListener("mouseleave", cancelMoveChild);
        });
        this.setMenu(this.menu);
    }
    getHeight() {
        return eheight(this.shadowRoot.querySelector(".windows"));
    }
    getTop() {
        return etop(this.shadowRoot.querySelector(".windows"));
    }
    removeColumn() {
        const app = this.parentNode;
        const i = elementIndex(this);
        app.removeColumn(i, this);
    }
    getMenu() {
        return this.menu.map(item => Object.assign({}, item));
    }
    setMenu(menu) {
        const nav = this.shadowRoot.querySelector("nav");
        console.assert(nav);

        // Remove 'a' tags from nav
        const links = Array.prototype.slice.call(nav.children).filter(elt => elt.nodeName === "A");
        links.forEach(link => {
            nav.removeChild(link);
        });

        // Clone the array so the user can't muck with the data, and set the new links.
        this.menu = menu.map(item => Object.assign({}, item));
        this.menu.forEach(item => {
            const elt = document.createElement("a");
            const title = item.title;
            const link = item.link;
            elt.innerText = item.title;
            if (typeof link === "string") {
                elt.setAttribute("href", item.link);
            } else if (typeof link === "function") {
                elt.setAttribute("href", "#");
                elt.addEventListener("click", () => {
                    link();
                });
            } else {
                throw new Error("Menu item link must be a URL or a function.");
            }
            nav.appendChild(elt);
        });
    }
    addWindow(win) {
        const lastWindowPct = (this.windows.length > 0) ? this.windows[this.windows.length-1] : 100;
        const columnHeight = this.getHeight();
        const lastWindowHeight = lastWindowPct * columnHeight / 100;
        const minDistance = 2 * 100;
        if (lastWindowHeight > minDistance) {
            const newWindow = win ? win : document.createElement("omnino-win");
            this.appendChild(newWindow);
            return makeWindowProxy(newWindow);
        }
        return null;
    }
    windowAdded() {
        // windowAdded() is called whenever columns are rearranged, but the windows need not be resized, so return early.
        if (this.ismoving) {
            return;
        }
        const windows = this.shadowRoot.querySelector(".windows");
        console.assert(windows);
        if (this.windows.length === 0) {
            this.windows.push(100);
            const style = "100%";
            windows.style.gridTemplateColumns = style;
        } else {
            const lastWindowHeight = this.windows.pop();
            const newLastWindowHeight = lastWindowHeight * 0.63;
            const newWindowHeight = lastWindowHeight - newLastWindowHeight;
            this.windows.push(newLastWindowHeight);
            this.windows.push(newWindowHeight);
            this.windows[this.windows.length-1] = reduceExcept(this.windows, (a, b) => a - b, 100, this.windows.length-1);
            this.updateWindows();
        }
        this.updateColor();
    }
    updateWindows() {
        const windows = this.shadowRoot.querySelector(".windows");
        const style = this.windows.map(percentage => `${percentage}%`).join(' ');
        windows.style.gridTemplateRows = style;
    }
    updateColor() {
        // When a column has no windows, fill it with a background color. Otherwise,
        // inherit the background color from the <body> tag so the background color
        // defined by the user may be inherited by the windows.
        const column = this.shadowRoot.querySelector(".column");
        console.assert(column);
        if (this.children.length === 0) {
            const bgcolor = getComputedStyle(this).getPropertyValue("--omnino-background-color");
            column.style.backgroundColor = (bgcolor) ? bgcolor : "white";
        } else {
            column.style.backgroundColor = "inherit";
        }
    }
    removeWindow(i, win) {
        // If the only node, just clear the height list.
        if (this.windows.length == 1) {
            this.windows = [];
        // If the first node, add height to the next.
        } else if (i == 0) {
            const w1 = this.windows.shift();
            const w2 = this.windows.shift();
            this.windows.unshift(w1+w2);
        // Otherwise add height to the previous.
        } else {
            const h1 = this.windows[i-1];
            const h2 = this.windows[i];
            this.windows.splice(i-1, 2, h1+h2);
        }
        this.removeChild(win);
        this.updateWindows();
        this.updateColor();
    }
    connectedCallback() {
        if (!this.ismoving) {
            this.parentElement.columnAdded();
        }
    }
}
customElements.define('omnino-col', OmninoColumn);

const etop = (elt) => {
    return elt.getBoundingClientRect().top;
};

const eleft = (elt) => {
    return elt.getBoundingClientRect().left;
};

const ewidth = (elt) => {
    return elt.getBoundingClientRect().width;
};

const eheight = (elt) => {
    return elt.getBoundingClientRect().height;
};

// Resize srcchild in its container. 'srcchild' is the element to be resized,
// 'app' is the top-level app relative to which positions are computed, 'p'
// is the position of the mouse relative to the app, 'position' is a function
// which gets the top or left position of an element, 'distance' is a function
// which gets the width or height of an element, 'minDistance' is the minimum
// size of a child, containerDistance is the size of the container holding the
// children, 'dd' is number whose sign indicates direction, and 'sizes' is the
// array of sizes of the children as percentages of the container size.
const resize = (srcchild, app, p, position, distance, minDistance, containerDistance, dd, sizes) => {
    const srcleft = srcchild.previousElementSibling;
    const shrinkChild = (dd < 0) ? srcleft : srcchild;
    const growChild = (dd < 0) ? srcchild : srcleft;
    if (shrinkChild !== null && growChild !== null) {
        const a = position(srcleft) - position(app);
        const b = position(srcchild) - position(app) + distance(srcchild);
        const newChildPos = clamp(a + minDistance, p, b - minDistance);
        if (newChildPos !== undefined) {
            const oldChildPos = position(srcchild) - position(app);
            const dd = oldChildPos - newChildPos;
            const distPct = Math.abs(dd * 100 / containerDistance);
            const shrinkidx = elementIndex(shrinkChild);
            const growidx = elementIndex(growChild);
            sizes[shrinkidx] -= distPct;
            sizes[growidx] += distPct;
            sizes[growidx] = reduceExcept(sizes, (a, b) => a - b, 100, growidx);
        }
    }
};

const reduceExcept = (arr, combine, initial, ...indices) => {
    let total = initial;
    for (let i = 0; i < arr.length; ++i) {
        if (indices.indexOf(i) < 0) {
            total = combine(total, arr[i]);
        }
    }
    return total;
};

const exchange = (srcchild, dstchild, p, app, position, distance, minDistance, containerDistance, sizes) => {
    const srcleft = srcchild.previousElementSibling;
    const srcright = srcchild.nextElementSibling;
    const neighbor = srcleft ? srcleft : (srcright ? srcright : null);
    const srcidx = elementIndex(srcchild);
    const dstidx = elementIndex(dstchild);
    const neighboridx = neighbor ? elementIndex(neighbor) : -1;
    const oldSrcChildDistancePct = sizes[srcidx];
    const oldDstChildDistancePct = sizes[dstidx];
    const a = position(dstchild) - position(app);
    const b = position(dstchild) - position(app) + distance(dstchild);
    const newChildPos = clamp(a + minDistance, p, b - minDistance);
    if (newChildPos !== undefined) {
        sizes[srcidx] = (b - newChildPos) * 100 / containerDistance;
        sizes[dstidx] -= sizes[srcidx];
        if (neighboridx >= 0) {
            sizes[neighboridx] += oldSrcChildDistancePct;
        }
        sizes[dstidx] = reduceExcept(sizes, (a, b) => a - b, 100, dstidx);
        moveElement(sizes, srcidx, dstidx+1);
        srcchild.ismoving = true;
        srcchild.parentElement.insertBefore(srcchild, dstchild.nextElementSibling);
        srcchild.ismoving = false;
    }
};

class OmninoWindow extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});     
        shadow.innerHTML = `
        <style>
        ${commonStyles}
        div.window { display: flex; flex: 1 1 auto; flex-flow: column; min-width: 0; min-height: 17px; background-color: inherit; }
        div.body { flex: 1 0 0; margin: 0; padding: var(--omnino-window-padding, 1em 1em 1em 1em); direction: rtl; min-height: 0; overflow-y: scroll; overflow-x: auto; display: flex; flex-flow: column; }
        div.content { direction: ltr; min-height: 0; flex: 1 0 auto; }
        div.handle { cursor: move; }
        :host { border-top: 2px solid var(--omnino-border-color, black); display: flex; flex-flow: column; }
        :host(:first-of-type) { border-top: none; }
        </style>
        <div class="window">
            <div class="header">
                <div class="handle"></div>
                <nav></nav>
            </div>
            <div class="body">
                <div class="content">
                    <slot></slot>
                </div>
            </div>
        </div>
        `;
        const srcchild = this;
        const handle = shadow.querySelector(".handle");
        handle.addEventListener("mousedown", mouseDownEvent => {
            // Compute offset of mouse from the top left of the column.
            const omninocol = srcchild.parentElement;
            const app = omninocol.parentElement;
            // The position of the mousedown event relative to the OmninoApplication.
            // The x displacement from the top-left corner of the column to the mouse.
            const mouseOffsetX = mouseDownEvent.clientX - eleft(srcchild);
            const mouseOffsetY = mouseDownEvent.clientY - etop(srcchild);

            // Store the offset in the parent to be used by its mouseup handler.
            app.style.cursor = "move";

            const cancelMoveChild = event => {
                app.removeEventListener("mouseup", moveChild);
                app.style.cursor = "default";
                app.removeEventListener("mouseleave", cancelMoveChild);
            };
            const moveChild = mouseUpEvent => {
                // Compute the position of the mouse event relative to OmninoApplication.
                const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                const dd = mouseUpEvent.clientY - mouseDownEvent.clientY;
                const x = clamp(0, mouseUpEvent.clientX - rect.left - mouseOffsetX);
                const y = mouseUpEvent.clientY - rect.top - mouseOffsetY;

                const minDistance = app.minColumnWidth;
                const containerDistance = omninocol.getHeight();

                // Determine in which column and window the mouseup event occured.
                const dstcol = reduceFirst(app.children, w => w >= x, (a, b) => a + ewidth(b), 0);
                console.assert(dstcol !== null);
                const dstchild = reduceFirst(dstcol.children, h => h >= y, (a, b) => a + eheight(b), 0);

                const srccol = omninocol;
                const srcleft = srcchild.previousElementSibling;
                const srcright = srcchild.nextElementSibling;
                const isResize = (dstcol === srccol && (srcchild === dstchild || (srcleft !== null && dstchild === srcleft)));
                const isMove = (dstcol !== srccol);
                const isExchange = (dstcol === srccol && dstchild !== null);
                const sizes = omninocol.windows;
                
                if (isResize) {
                    resize(srcchild, app, y, etop, eheight, minDistance, containerDistance, dd, sizes);
                } else if (isMove) {
                    const destinationColumnIsEmpty = (dstchild === null);
                    srcchild.removeWindow();
                    if (destinationColumnIsEmpty) {
                        dstcol.addWindow(srcchild);
                    } else {
                        const a = etop(dstchild);
                        const b = etop(dstchild) + eheight(dstchild);
                        const mid = clamp(a + minDistance, y, b - minDistance);
                        if (mid !== undefined) {
                            const dd = mid - a;
                            const heightPct = Math.abs(dd * 100 / containerDistance);
                            const dstidx = elementIndex(dstchild);
                            const oldDstWindowHeightPct = dstcol.windows[dstidx];
                            // Set dstchild's height to mid - a as a percentage of the column's window container
                            dstcol.windows[dstidx] = heightPct;
                            dstcol.windows.splice(dstidx+1, 0, oldDstWindowHeightPct - heightPct);
                            dstcol.windows[dstidx+1] = reduceExcept(dstcol.windows, (a, b) => a - b, 100, dstidx+1);
                            this.ismoving = true;
                            dstcol.insertBefore(srcchild, dstchild.nextElementSibling);
                            this.ismoving = false;
                        }
                    }
                } else if (isExchange) {
                    exchange(srcchild, dstchild, y, app, etop, eheight, minDistance, containerDistance, sizes);
                }
                omninocol.updateWindows();
                dstcol.updateWindows();
                cancelMoveChild(mouseUpEvent);
            };
            app.addEventListener("mouseup", moveChild);
            app.addEventListener("mouseleave", cancelMoveChild);
        });
        this.menu = [
            {
                title: "Delwin",
                link: this.removeWindow.bind(this),
            },
        ];   
        this.setMenu(this.menu);
    }
    contentHeight() {
        const content = this.shadowRoot.querySelector(".content");
        return content.scrollHeight;
    }
    removeWindow() {
        const column = this.parentNode;
        const i = elementIndex(this);
        column.removeWindow(i, this);
    }
    setTitle(title) {
        const nav = this.shadowRoot.querySelector("nav");
        let h2 = nav.querySelector("h2");
        if (title) {
            if (h2 === null) {
                h2 = document.createElement("h2");
                nav.insertBefore(h2, nav.firstChild);
            }
            h2.innerText = title;
        } else if (h2 !== null) {
            nav.removeChild(h2);
        }
    }
    getMenu() {
        return this.menu.map(item => Object.assign({}, item));
    }
    setMenu(menu) {
        const nav = this.shadowRoot.querySelector("nav");
        console.assert(nav);

        // Remove 'a' tags from nav
        const links = Array.prototype.slice.call(nav.children).filter(elt => elt.nodeName === "A");
        links.forEach(link => {
            nav.removeChild(link);
        });

        // Clone the array so the user can't muck with the data, and set the new links.
        this.menu = menu.map(item => Object.assign({}, item));
        this.menu.forEach(item => {
            const elt = document.createElement("a");
            const title = item.title;
            const link = item.link;
            elt.innerText = item.title;
            if (typeof link === "string") {
                elt.setAttribute("href", item.link);
            } else if (typeof link === "function") {
                elt.setAttribute("href", "#");
                elt.addEventListener("click", () => {
                    link();
                });
            } else {
                throw new Error("Menu item link must be a URL or a function.");
            }
            nav.appendChild(elt);
        });
    }
    connectedCallback() {
        if (!this.ismoving) {
            this.parentElement.windowAdded();
        }
    }
}
customElements.define('omnino-win', OmninoWindow);

const makeApplicationProxy = (app) => {
    const data = {
        app: app,
    };
    const attached = () => {
        return app.parentElement !== null;
    };
    const proxy = {
        attached: attached,
        remove: () => {
            if (!attached()) {
                throw new Error("Can't delete an Omnino application that has already been deleted.");
            }
            data.app.parentElement.removeChild(data.app);
        },
        getMenu: () => {
            if (!attached()) {
                throw new Error("Can't get the top-level menu of a deleted Omnino application.");
            }
            return data.app.getMenu();
        },
        setMenu: menu => {
            if (!attached()) {
                throw new Error("Can't set the top-level menu of a deleted Omnino application.");
            }
            data.app.setMenu(menu);
        },
        addColumn: () => {
            if (!attached()) {
                throw new Error("Can't add a column to a deleted Omnino application.");
            }
            return data.app.addColumn();
        },
        columns: () => {
            return Array.prototype.map.call(data.app.children, makeColumnProxy);
        },
        addWindow: () => {
            // TODO: Add a column if none exists, then add window to it and return window proxy.
        },
    };
    return proxy;
};

const makeColumnProxy = (column) => {
    const data = {
        column: column,
    };
    const attached = () => {
        return data.column.parentElement !== null;
    };
    const proxy = {
        attached: attached,
        remove: () => {
            if (!attached()) {
                throw new Error("Can't delete a column this is already deleted.");
            }
            const app = data.column.parentNode;
            const i = elementIndex(data.column);
            app.removeColumn(i, data.column);
        },
        getMenu: () => {
            if (!attached()) {
                throw new Error("Can't get the menu of a deleted column.");
            }
            return data.column.getMenu();
        },
        setMenu: menu => {
            if (!attached()) {
                throw new Error("Can't set the menu of deleted column.");
            }
            data.column.setMenu(menu);
        },
        addWindow: (win) => {
            if (!attached()) {
                throw new Error("Can't set the menu of deleted column.");
            }
            return data.column.addWindow(win);
        },
        windows: () => {
            return Array.prototype.map.call(data.column.children, makeWindowProxy);
        },
    };
    return proxy;
};

const makeWindowProxy = (window) => {
    const data = {
        window: window,
    };
    const attached = () => {
        return data.window.parentElement !== null;
    };
    const proxy = {
        attached: attached,
        remove: () => {
            if (!attached()) {
                throw new Error("Can't delete a column this is already deleted.");
            }
            const column = data.window.parentNode;
            const i = elementIndex(data.column);
            column.removeColumn(i, data.column);
        },
        getMenu: () => {
            if (!attached()) {
                throw new Error("Can't get the menu of a deleted column.");
            }
            return data.window.getMenu();
        },
        setMenu: menu => {
            if (!attached()) {
                throw new Error("Can't set the menu of deleted column.");
            }
            data.window.setMenu(menu);
        },
        setContent: (content) => {
            while (data.window.children.length > 0) {
                data.window.removeChild(data.window[0]);
            }
            if (Array.isArray(content)) {
                content.forEach(item => data.window.appendChild(item));
            } else {
                data.window.appendChild(content);
            }
        },
        contentHeight: () => {
            return data.window.contentHeight();
        },
        setTitle: (title) => {
            data.window.setTitle(title);
        },
    };
    return proxy;
};

const install = (container) => {
    const app = document.createElement('omnino-app');
    container.appendChild(app);
    const proxy = makeApplicationProxy(app);
    return proxy;
};

return {
    install: install,
}
})();
