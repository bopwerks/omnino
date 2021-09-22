const commonStyles = `
div.header { background: var(--omnino-menu-background, #eefdfd); color: var(--omnino-menu-fgcolor, black); display: grid; grid-template-columns: 17px 1fr; border-bottom: 1px solid var(--omnino-border-color, black); flex: 0 1 auto; }
div.header > nav { display: flex; flex-flow: row; overflow-x: hidden; align-items: center; font-family: Verdana; font-size: 0.8em; }
div.header > nav > h1, h2 { font-size: 1em; margin: 0 0.3em 0 0.3em; white-space: nowrap; }
div.header > nav > h1::after { content: var(--omnino-title, "Omnino"); }
nav > a { color: inherit; text-decoration: none; margin: 0; padding: 0.1em 0.4em 0.1em 0.4em; }
nav > a:hover { background-color: var(--omnino-link-hover-color, #C6FDFD); }
nav > a:active { background-color: var(--omnino-link-active-color, #a6FDFD); }
div.column:first-of-type { border-left: none; }
div.handle { background: var(--omnino-handle-color, #7C7ABD); }
div.loading { background: linear-gradient(to left, #afadee, #eefdfd 100%); }
`;

const fixPrecision = n => {
    return Math.round((n + Number.EPSILON) * 10000) / 10000;
};

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
            {
                title: "Help",
                link: "/",
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
        // TODO: Verify that the rightmost column has 2*minDistance space
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
            const newColumnWidth = fixPrecision(lastColumnWidth * 0.37);
            const newLastColumnWidth = fixPrecision(lastColumnWidth - newColumnWidth);
            this.columns.push(newLastColumnWidth);
            this.columns.push(newColumnWidth);
        }
        this.updateColumns();
        this.updateColor();
    }
    updateColumns() {
        const columns = this.shadowRoot.querySelector(".columns");
        console.assert(columns);
        const totalWidth = fixPrecision(this.columns.reduce(((acc, cur) => acc + cur), 0));
        console.assert((this.columns.length > 0 && totalWidth === 100) || (this.columns.length === 0 && totalWidth === 0));
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
            this.columns.unshift(fixPrecision(w1+w2));
        // Otherwise add width to the previous and remove.
        } else {
            const w1 = this.columns[i-1];
            const w2 = this.columns[i];
            this.columns.splice(i-1, 2, fixPrecision(w1+w2));
        }
        const totalWidth = fixPrecision(this.columns.reduce(((acc, cur) => acc + cur), 0));
        console.assert((this.columns.length > 0 && totalWidth === 100) || (this.columns.length === 0 && totalWidth === 0));
        this.removeChild(col);
        const style = this.columns.map(percentage => `${percentage}%`).join(' ');
        const columns = this.shadowRoot.querySelector(".columns");
        console.assert(columns);
        columns.style.gridTemplateColumns = style;
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

        const style = document.createElement("style");
        style.textContent = `
        ${commonStyles}
        div.header { border-bottom-width: 2px; }
        div.column { display: flex; flex-flow: column; height: 100%; min-width: 0; background: var(--omnino-background-color, white); }
        div.windows { flex: 1 1 auto; display: grid; min-width: 0; grid-template-rows: 100%; }
        div.handle { cursor: move; }
        :host { border-left: 2px solid var(--omnino-border-color, black); }
        :host(:first-of-type) { border-left: none; }
        `;
        shadow.appendChild(style);

        const omninocol = this;
        const column = document.createElement("div");
        column.classList.add("column");
        {
            const header = document.createElement("div");
            header.classList.add("header");
            header.style.gridTemplateColumns = `${getScrollbarWidth()}px 1fr`;

            const windows = document.createElement("div");
            windows.classList.add("windows");
            windows.innerHTML = `<slot></slot>`;
            windows.style.gridTemplateRows = "100%";
            {
                const handle = document.createElement("div");
                handle.classList.add("handle");
                handle.addEventListener("mousedown", mouseDownEvent => {
                    // Compute offset of mouse from the top left of the column.
                    const app = omninocol.parentElement;
                    const colrect = omninocol.getBoundingClientRect();
                    // The position of the mousedown event relative to the OmninoApplication.
                    const mouseDownX = mouseDownEvent.clientX - eleft(app);
                    // The x displacement from the top-left corner of the column to the mouse.
                    const mouseOffsetX = mouseDownEvent.clientX - colrect.left; //x position within the element.

                    // Store the offset in the parent to be used by its mouseup handler.
                    app.style.cursor = "move";
                    app.style.userSelect = "none";

                    // TODO: Add mouseup handler
                    const cancelMoveChild = event => {
                        app.removeEventListener("mouseup", moveChild);
                        app.style.cursor = "default";
                        app.style.userSelect = "auto";
                        app.removeEventListener("mouseleave", cancelMoveChild);
                    };
                    const moveChild = mouseUpEvent => {
                        // Compute the position of the mouse event relative to OmninoApplication.
                        const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                        const dd = mouseUpEvent.clientX - mouseDownEvent.clientX;
                        const x = mouseUpEvent.clientX - rect.left - mouseOffsetX; //x position within the element, offset by the mouse.

                        const minDistance = app.minColumnWidth;
                        const containerDistance = app.getBoundingClientRect().width;

                        // Determine in which column the current mouse x-position would fall.
                        let dstcol = null;
                        for (let i = 0, w = 0; i < app.children.length && w < x; ++i) {
                            dstcol = app.children[i];
                            const r = dstcol.getBoundingClientRect();
                            w += r.width;
                        }
                        console.assert(dstcol !== null);

                        const srcchild = omninocol;
                        const srcleft = srcchild.previousElementSibling;
                        const srcright = srcchild.nextElementSibling;
                        const isResize = (dstcol === srcchild || (srcleft !== null && dstcol === srcleft));
                        const sizes = app.columns;
                        
                        if (isResize) {
                            resize(srcchild, app, x, eleft, ewidth, minDistance, containerDistance, dd, sizes);
                        } else {
                            const neighborcol = srcleft ? srcleft : (srcright ? srcright : null);

                            const srcidx = elementIndex(srcchild);
                            const dstidx = elementIndex(dstcol);
                            const neighboridx = neighborcol ? elementIndex(neighborcol) : -1;

                            // TODO: Find x coordinate of moved column's new position
                            const oldSrcColumnWidthPct = sizes[srcidx];
                            const oldDstColumnWidthPct = sizes[dstidx];
                            const a = dstcol.offsetLeft - eleft(app);
                            const b = dstcol.offsetLeft - eleft(app) + dstcol.offsetWidth;
                            const newChildPos = clamp(a + minDistance, x, b - minDistance);
                            if (newChildPos !== undefined) {
                                // Make room for the source column in the dest column and grow the neighbor column
                                const newSrcColumnWidth = b - newChildPos;
                                const newSrcColumnWidthPct = fixPrecision(Math.abs(newSrcColumnWidth * 100 / containerDistance));
                                const newDstColumnWidthPct = fixPrecision(oldDstColumnWidthPct - newSrcColumnWidthPct);
                                sizes[srcidx] = newSrcColumnWidthPct;
                                sizes[dstidx] = newDstColumnWidthPct;
                                if (neighboridx >= 0) {
                                    sizes[neighboridx] = fixPrecision(sizes[neighboridx] + oldSrcColumnWidthPct);
                                }
                                // Move source column after dest column
                                moveElement(sizes, srcidx, dstidx+1);
                                this.ismoving = true;
                                app.insertBefore(srcchild, dstcol.nextElementSibling);
                                this.ismoving = false;
                            }
                        }
                        app.updateColumns();
                        cancelMoveChild(event);
                    };
                    app.addEventListener("mouseup", moveChild);
                    app.addEventListener("mouseleave", cancelMoveChild);
                });
                header.appendChild(handle);

                const nav = document.createElement("nav");
                {
                    // const title = document.createElement("h2");
                    // nav.appendChild(title);
                }
                header.appendChild(nav);
            }
            column.appendChild(header);
            column.appendChild(windows);
        }
        shadow.appendChild(column);
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
        const newWindow = win ? win : document.createElement("omnino-win");
        this.appendChild(newWindow);
        return makeWindowProxy(newWindow);
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
            const newLastWindowHeight = fixPrecision(lastWindowHeight * 0.63);
            const newWindowHeight = fixPrecision(lastWindowHeight - newLastWindowHeight);
            this.windows.push(newLastWindowHeight);
            this.windows.push(newWindowHeight);
            this.updateWindows();
        }
        this.updateColor();
    }
    updateWindows() {
        const windows = this.shadowRoot.querySelector(".windows");
        const totalHeight = this.windows.reduce((acc, cur) => acc + cur, 0);
        console.assert((this.windows.length > 0 && totalHeight === 100) || (this.windows.length === 0 && totalHeight === 0));
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
            const distPct = fixPrecision(Math.abs(dd * 100 / containerDistance));
            const shrinkidx = elementIndex(shrinkChild);
            const growidx = elementIndex(growChild);
            sizes[shrinkidx] = fixPrecision(sizes[shrinkidx] - distPct);
            sizes[growidx] = fixPrecision(sizes[growidx] + distPct);
        }
    }
};

class OmninoWindow extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        this.menu = [
            {
                title: "Delwin",
                link: this.removeWindow.bind(this),
            },
        ];

        const style = document.createElement("style");
        style.textContent = `
        ${commonStyles}
        div.window { display: flex; flex: 1 1 auto; flex-flow: column; min-width: 0; min-height: 17px; background-color: inherit; }
        div.body { flex: 1 0 0; margin: 0; padding: var(--omnino-window-padding, 0 1em 1em 1em); direction: rtl; min-height: 0; overflow-y: scroll; overflow-x: auto; display: flex; flex-flow: column; }
        div.content { direction: ltr; min-height: 0; flex: 1 0 auto; }
        div.handle { cursor: move; }
        :host { border-top: 2px solid var(--omnino-border-color, black); display: flex; flex-flow: column; }
        :host(:first-of-type) { border-top: none; }
        `;
        shadow.appendChild(style);

        const srcchild = this;
        const window = document.createElement("div");
        window.classList.add("window");
        {
            const header = document.createElement("div");
            header.classList.add("header");
            header.style.gridTemplateColumns = `${getScrollbarWidth()}px 1fr`;
            {
                const handle = document.createElement("div");
                handle.classList.add("handle");
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
                    app.style.userSelect = "none";

                    // TODO: Add mouseup handler
                    const cancelMoveChild = event => {
                        app.removeEventListener("mouseup", moveChild);
                        app.style.cursor = "default";
                        app.style.userSelect = "auto";
                        app.removeEventListener("mouseleave", cancelMoveChild);
                    };
                    const moveChild = mouseUpEvent => {
                        // Compute the position of the mouse event relative to OmninoApplication.
                        const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                        const dd = mouseUpEvent.clientY - mouseDownEvent.clientY;
                        // x is the horizontal position of the mouseup event relative to the omnino-app
                        const x = clamp(0, mouseUpEvent.clientX - rect.left - mouseOffsetX); //x position within the element, offset by the mouse.
                        // y is the vertical position of the mouseup event relative to the omnino-app
                        const y = mouseUpEvent.clientY - rect.top - mouseOffsetY;

                        const minDistance = app.minColumnWidth;
                        const containerDistance = omninocol.getHeight();

                        // Determine in which column and window the mouseup event occured.
                        let dstcol = app.children[0];
                        for (let i = 0, w = 0; i < app.children.length && w < x; ++i) {
                            dstcol = app.children[i];
                            const r = dstcol.getBoundingClientRect();
                            w += r.width;
                        }
                        console.assert(dstcol !== null);

                        let dstchild = null;
                        for (let i = 0, h = 0; i < dstcol.children.length && h < y; ++i) {
                            dstchild = dstcol.children[i];
                            const r = dstchild.getBoundingClientRect();
                            h += r.height;
                        }

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
                            if (destinationColumnIsEmpty) {
                                srcchild.removeWindow();
                                dstcol.addWindow(srcchild);
                            } else {
                                srcchild.removeWindow();
                                // a is the position of dstchild's top edge relative to the omnino-app
                                const a = etop(dstchild);
                                // b is the position of dstchild's bottom edge relative to the omnino-app
                                const b = etop(dstchild) + eheight(dstchild);
                                const mid = clamp(a + minDistance, y, b - minDistance);
                                if (mid !== undefined) {
                                    const dd = mid - a;
                                    const heightPct = fixPrecision(Math.abs(dd * 100 / containerDistance));
                                    const dstidx = elementIndex(dstchild);
                                    const oldDstWindowHeightPct = dstcol.windows[dstidx];
                                    // Set dstchild's height to mid - a as a percentage of the column's window container
                                    dstcol.windows[dstidx] = fixPrecision(heightPct);
                                    // TODO: srcchild's height is set to b - mid as a percentage of the column's window container
                                    dstcol.windows.splice(dstidx+1, 0, fixPrecision(oldDstWindowHeightPct - heightPct));
                                    // TODO: srcchild is inserted after dstchild
                                    this.ismoving = true;
                                    dstcol.insertBefore(srcchild, dstchild.nextElementSibling);
                                    this.ismoving = false;
                                }
                            }
                        } else if (isExchange) {
                            const neighborwin = srcleft ? srcleft : (srcright ? srcright : null);

                            const srcidx = elementIndex(srcchild);
                            const dstidx = elementIndex(dstchild);
                            const neighboridx = neighborwin ? elementIndex(neighborwin) : -1;

                            const oldSrcWindowHeightPct = sizes[srcidx];
                            const oldDstWindowHeightPct = sizes[dstidx];
                            const a = etop(dstchild) - etop(app);
                            const b = etop(dstchild) - etop(app) + eheight(dstchild);
                            const newChildPos = clamp(a + minDistance, y, b - minDistance);
                            if (newChildPos !== undefined) {
                                // Make room for the source column in the dest column and grow the neighbor column
                                const newSrcWindowHeight = b - newChildPos;
                                const newSrcWindowHeightPct = fixPrecision(newSrcWindowHeight * 100 / containerDistance);
                                const newDstWindowHeightPct = fixPrecision(oldDstWindowHeightPct - newSrcWindowHeightPct);
                                sizes[srcidx] = newSrcWindowHeightPct;
                                sizes[dstidx] = newDstWindowHeightPct;
                                if (neighboridx >= 0) {
                                    sizes[neighboridx] = fixPrecision(sizes[neighboridx] + oldSrcWindowHeightPct);
                                }
                                // Move source window after dest window
                                moveElement(sizes, srcidx, dstidx+1);
                                this.ismoving = true;
                                dstcol.insertBefore(srcchild, dstchild.nextElementSibling);
                                this.ismoving = false;
                            }
                        }
                        omninocol.updateWindows();
                        dstcol.updateWindows();
                        cancelMoveChild(event);
                    };
                    app.addEventListener("mouseup", moveChild);
                    app.addEventListener("mouseleave", cancelMoveChild);
                });
                header.appendChild(handle);

                const nav = document.createElement("nav");
                {
                }
                header.appendChild(nav);
            }
            window.appendChild(header);

            const body = document.createElement("div");
            body.classList.add("body");
            {
                const content = document.createElement("div");
                content.classList.add("content");
                content.innerHTML = `<slot></slot>`;
                body.appendChild(content);
            }
            window.appendChild(body);
        }
        shadow.appendChild(window);
        this.setMenu(this.menu);
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
        addWindow: () => {
            if (!attached()) {
                throw new Error("Can't set the menu of deleted column.");
            }
            return data.column.addWindow();
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

const setup = (app, elts, title) => {
    // Move the elements to a top-level div to simplify cloning.
    const root = document.createElement("div");
    elts.forEach(elt => root.appendChild(elt));
    
    // Creating a new window
    const makeNewWindowFunc = (column, elts) => {
        return () => {
            const win = column.addWindow();
            if (win !== null) {
                win.setTitle(title);
                win.setContent(root.cloneNode(true));
            }
            return win;
        };
    }

    // Make the "Newcol" button create a new column.
    const appMenu = app.getMenu();
    const addColumn = () => {
        const col = app.addColumn();
        if (col !== null) {
            const colMenu = col.getMenu();
            colMenu[0].link = makeNewWindowFunc(col, elts);
            col.setMenu(colMenu);
        }
        return col;
    };
    appMenu[0].link = addColumn;
    app.setMenu(appMenu);

    // Add two columns and one window.
    const col1 = addColumn();
    const makeWindow = makeNewWindowFunc(col1, elts);
    makeWindow();
    const col2 = addColumn();
    return app;
};

const removeElements = (container) => {
    const elts = Array.prototype.slice.call(container.children).filter(elt => elt.nodeName !== "SCRIPT");
    elts.forEach(elt => container.removeChild(elt));
    return elts;
};

window.addEventListener("load", () => {
    const body = document.querySelector("body");
    console.assert(body);
    const elts = removeElements(body);
    const app = setup(install(body), elts, document.title);
});
