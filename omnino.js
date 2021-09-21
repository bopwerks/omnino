const commonStyles = `
/**
 * There is a header div at the top of the screen to provide top-level functions,
 * a header div at the top of each column to create new windows and delete the column,
 * and a header div at the top of each window to provide context-specific functions
 * and delete the window.
 *
 * Each header contains a square handle used to move the column or window around,
 * and a nav element containing an optional title and menu buttons.
 *
 * The header is a flex item which should only consume enough height space for its
 * contents.
 *
 * The header uses a grid layout to ensure that the square handle is a specific width
 * and consumes the full height of the header.
 */
div.header {
    background: var(--omnino-menu-background, #eefdfd);
    color: var(--omnino-menu-fgcolor, black);
    display: grid;
    grid-template-columns: 17px 1fr;
    border-bottom: 1px solid var(--omnino-border-color, black);
    flex: 0 1 auto;
}

/**
 * The nav portion of the header contains an optional title and menu buttons. It uses
 * a flex layout to position items as we might have done using float: left years ago.
 * The flex layout gives us the advantage that items won't wrap as the nav is resized.
 *
 * We use overflow-x: hidden here to ensure that text never blows outside the container
 * when the nav is resized.
 */
div.header > nav {
    display: flex;
    flex-flow: row;
    overflow-x: hidden;
    align-items: center;
    font-family: Verdana;
    font-size: 0.8em;
}

div.header > nav > h1, h2 {
    font-size: 1em;
    margin: 0 0.3em 0 0.3em;
    white-space: nowrap;
}

div.header > nav > h1::after {
    content: var(--omnino-title, "Omnino");
}

nav > a {
    color: inherit;
    text-decoration: none;
    margin: 0;
    padding: 0.1em 0.4em 0.1em 0.4em;
}

nav > a:hover {
    background-color: var(--omnino-link-hover-color, #C6FDFD);
}

nav > a:active {
    background-color: var(--omnino-link-active-color, #a6FDFD);
}

div.column:first-of-type {
    border-left: none;
}

div.handle {
    background: var(--omnino-handle-color, #7C7ABD);
}

div.loading {
    background: linear-gradient(to left, #afadee, #eefdfd 100%);
}
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
        div.header {
            border-bottom-width: 2px;
        }
        /**
         * The wrapper div contains everything else. We use flex columns so that the nav
         * bar at the top of the screen is just high enough to contain its elements, and
         * the columns consume the rest of the space.
         */
        div.wrapper {
            width: 100%;
            height: 100%;
            /* position: absolute;
            top: 100px;
            left: 100px;
            width: 1000px;
            height: 1000px; */
            display: flex;
            flex-flow: column;
        }
        div.columns {
            flex: 1 1 auto;
            display: grid;
            background: var(--omnino-background-color, white);
        }
        /*::slotted(omnino-col)  { border-left: 1px solid var(--omnino-border-color, black); }*/
        /*::slotted(omnino-col) { border-left: 5px solid black; }*/
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
        // TODO: Verify that the rightmost column has 2*minWidth space
        const lastColumnPct = (this.columns.length > 0) ? this.columns[this.columns.length-1] : 100;
        const appWidth = this.getBoundingClientRect().width;
        const lastColumnWidth = lastColumnPct * appWidth / 100;
        const minWidth = 2 * this.minColumnWidth;
        if (lastColumnWidth > minWidth) {
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
            //console.log(`Columns: ${style}`)
        } else {
            // TODO: Check to see if there's enough space in the rightmost column
            // to accomodate another column and fail if not.

            // Reduce the rightmost column width by half.
            // Set the new column equal to this width.
            const lastColumnWidth = this.columns.pop();
            // console.log(`Last Column Width: ${lastColumnWidth}`);
            //const newColumnWidth = lastColumnWidth * 0.37;
            const newColumnWidth = fixPrecision(lastColumnWidth * 0.37);
            const newLastColumnWidth = fixPrecision(lastColumnWidth - newColumnWidth);
            // console.log(`${lastColumnWidth}% split into ${newLastColumnWidth}% and ${newColumnWidth}%`);
            this.columns.push(newLastColumnWidth);
            this.columns.push(newColumnWidth);
            // const totalWidth = fixPrecision(this.columns.reduce(((acc, cur) => acc + cur), 0));
            // console.assert((this.columns.length > 0 && totalWidth === 100) || (this.columns.length === 0 && totalWidth === 0));
            // const style = this.columns.map(percentage => `${percentage}%`).join(' ');
            // columns.style.gridTemplateColumns = style;
            //console.log(`Columns: ${style}`)
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
        console.log(`Column %s: ${this.columns} Sum = ${totalWidth}`);
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
        //console.log(`Columns: ${style}`)
        columns.style.gridTemplateColumns = style;
        this.updateColor();
    }
    setMouseOffset(offset) {
        this.mouseOffset = offset;
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
        div.header {
            border-bottom-width: 2px;
        }
        div.column {
            display: flex;
            flex-flow: column;
            height: 100%;
            min-width: 0;
            background: var(--omnino-background-color, white);
        }
        div.windows {
            flex: 1 1 auto;
            display: grid;
            min-width: 0;
            grid-template-rows: 100%;
        }
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
                    const apprect = app.getBoundingClientRect();
                    // console.log(`App left: ${apprect.left}`);
                    const colrect = omninocol.getBoundingClientRect();
                    // console.log(`Source column left: ${colrect.left}`);
                    // console.log(`Mouse X: ${mouseDownEvent.clientX}`);
                    // The position of the column relative to the OmninoApplication.
                    const oldColumnX = colrect.left - apprect.left;
                    // The position of the mousedown event relative to the OmninoApplication.
                    const mouseDownX = mouseDownEvent.clientX - apprect.left;
                    // The x displacement from the top-left corner of the column to the mouse.
                    const mouseOffsetX = mouseDownEvent.clientX - colrect.left; //x position within the element.
                    // console.log(`Mouse offset X: ${mouseOffsetX}`);

                    // Store the offset in the parent to be used by its mouseup handler.
                    //app.setMouseOffset({x: x, y: y});
                    app.style.cursor = "move";
                    app.style.userSelect = "none";

                    // TODO: Add mouseup handler
                    const cancelColumnMovement = event => {
                        app.removeEventListener("mouseup", moveColumns);
                        app.style.cursor = "default";
                        app.style.userSelect = "auto";
                        app.removeEventListener("mouseleave", cancelColumnMovement);
                    };
                    const moveColumns = mouseUpEvent => {
                        // Compute the position of the mouse event relative to OmninoApplication.
                        const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                        const dx = mouseUpEvent.clientX - mouseDownEvent.clientX;
                        const x = mouseUpEvent.clientX - rect.left - mouseOffsetX; //x position within the element, offset by the mouse.

                        const minWidth = app.minColumnWidth;
                        const appWidth = app.getBoundingClientRect().width;

                        // Determine in which column the current mouse x-position would fall.
                        //const srccol = omninocol;
                        //const leftcol = srccol.previousElementSibling;
                        //const rightcol = srccol.nextElementSibling;
                        let dstcol = null;
                        for (let i = 0, w = 0; i < app.children.length && w < x; ++i) {
                            dstcol = app.children[i];
                            const r = dstcol.getBoundingClientRect();
                            w += r.width;
                        }
                        console.assert(dstcol !== null);
                        // console.log("Target Column:", dstcol);

                        const srccol = omninocol;
                        const srcleft = srccol.previousElementSibling;
                        const srcright = srccol.nextElementSibling;
                        const isResize = (dstcol === srccol || (srcleft !== null && dstcol === srcleft));
                        
                        if (isResize) {
                            const shrinkcol = (dx < 0) ? srcleft : srccol;
                            const growcol = (dx < 0) ? srccol : srcleft;
                            if (shrinkcol !== null && growcol !== null) {
                                const shrinkidx = elementIndex(shrinkcol);
                                const growidx = elementIndex(growcol);
    
                                const a = srcleft.offsetLeft - apprect.left;
                                const b = srccol.offsetLeft - apprect.left + srccol.offsetWidth;
                                const newColumnX = clamp(a + minWidth, x, b - minWidth);
                                if (newColumnX !== undefined) {
                                    const dx = oldColumnX - newColumnX;
                                    // console.log(`Dx: ${dx}`);
                                
                                    // Grow and shrink columns by dx
                                    const widthPct = fixPrecision(Math.abs(dx * 100 / appWidth));
                                    app.columns[shrinkidx] = fixPrecision(app.columns[shrinkidx] - widthPct);
                                    app.columns[growidx] = fixPrecision(app.columns[growidx] + widthPct);
                                }
                            }
                        } else {
                            const neighborcol = srcleft ? srcleft : (srcright ? srcright : null);

                            const srcidx = elementIndex(srccol);
                            const dstidx = elementIndex(dstcol);
                            const neighboridx = neighborcol ? elementIndex(neighborcol) : -1;

                            // TODO: Find x coordinate of moved column's new position
                            const oldSrcColumnWidthPct = app.columns[srcidx];
                            const oldDstColumnWidthPct = app.columns[dstidx];
                            const a = dstcol.offsetLeft - apprect.left;
                            const b = dstcol.offsetLeft - apprect.left + dstcol.offsetWidth;
                            const newColumnX = clamp(a + minWidth, x, b - minWidth);
                            if (newColumnX !== undefined) {
                                // Make room for the source column in the dest column and grow the neighbor column
                                const newSrcColumnWidth = b - newColumnX;
                                const newSrcColumnWidthPct = fixPrecision(Math.abs(newSrcColumnWidth * 100 / appWidth));
                                const newDstColumnWidthPct = fixPrecision(oldDstColumnWidthPct - newSrcColumnWidthPct);
                                app.columns[srcidx] = newSrcColumnWidthPct;
                                app.columns[dstidx] = newDstColumnWidthPct;
                                if (neighboridx >= 0) {
                                    app.columns[neighboridx] = fixPrecision(app.columns[neighboridx] + oldSrcColumnWidthPct);
                                }
                                // app.columns[srcidx] = newSrcColumnWidthPct;
                                // Move source column after dest column
                                const moveElement = (arr, i, j) => {
                                    const elt = arr[i];
                                    arr.splice(i, 1);
                                    arr.splice((i < j) ? j-1 : j, 0, elt);
                                    // if (i < j) {
                                    //     arr.splice(j-1, 0, elt);
                                    // } else if (i > j) {
                                    //     arr.splice(j, 0, elt);
                                    // }
                                }
                                moveElement(app.columns, srcidx, dstidx+1);
                                // app.columns = app.columns.map((elt, i, arr) => {
                                //     if 
                                // });
                                // app.columns.splice(dstidx+1, 0, newSrcColumnWidthPct);
                                // app.columns.splice(srcidx, 1);
                                this.ismoving = true;
                                app.insertBefore(srccol, dstcol.nextElementSibling);
                                this.ismoving = false;
                            }
                        }
                        app.updateColumns();
                        cancelColumnMovement(event);
                    };
                    app.addEventListener("mouseup", moveColumns);
                    app.addEventListener("mouseleave", cancelColumnMovement);
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
        const windows = this.shadowRoot.querySelector(".windows");
        const rect = windows.getBoundingClientRect();
        return rect.height;
    }
    getTop() {
        const windows = this.shadowRoot.querySelector(".windows");
        const rect = windows.getBoundingClientRect();
        return rect.top;
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
            //console.log(`Column ${elementIndex(this)+1} Windows: ${style}`)
        } else {
            // TODO: Check to see if there's enough space in the rightmost column
            // to accomodate another column and fail if not.

            // Reduce the rightmost column width by half.
            // Set the new column equal to this width.
            const lastWindowHeight = this.windows.pop();
            const newLastWindowHeight = fixPrecision(lastWindowHeight * 0.63);
            const newWindowHeight = fixPrecision(lastWindowHeight - newLastWindowHeight);
            this.windows.push(newLastWindowHeight);
            this.windows.push(newWindowHeight);
            this.updateWindows();
            // const totalHeight = this.windows.reduce((acc, cur) => acc + cur, 0);
            // console.assert((this.windows.length > 0 && totalHeight === 100) || (this.windows.length === 0 && totalHeight === 0));
            // const style = this.windows.map(percentage => `${percentage}%`).join(' ');
            // windows.style.gridTemplateRows = style;
            //console.log(`Column ${elementIndex(this)+1} Windows: ${style}`)
        }
        this.updateColor();
    }
    updateWindows() {
        const windows = this.shadowRoot.querySelector(".windows");
        const totalHeight = this.windows.reduce((acc, cur) => acc + cur, 0);
        console.assert((this.windows.length > 0 && totalHeight === 100) || (this.windows.length === 0 && totalHeight === 0));
        const style = this.windows.map(percentage => `${percentage}%`).join(' ');
        windows.style.gridTemplateRows = style;
        console.log(`Window %s: ${this.windows} Sum = ${totalHeight}`);
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
        // const totalHeight = this.windows.reduce((acc, cur) => acc + cur, 0);
        // console.assert((this.windows.length > 0 && totalHeight === 100) || (this.windows.length === 0 && totalHeight === 0));
        // const style = this.windows.map(percentage => `${percentage}%`).join(' ');
        // const windows = this.shadowRoot.querySelector(".windows");
        // console.assert(windows);
        // // console.log(`Column ${elementIndex(this)+1} Windows: ${style}`);
        // windows.style.gridTemplateRows = style;
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
        div.window {
            display: flex;
            flex: 1 1 auto;
            flex-flow: column;
            min-width: 0;
            min-height: 17px;
            background-color: inherit;
        }
        div.body {
            flex: 1 0 0;
            margin: 0;
            padding: var(--omnino-window-padding, 0 1em 1em 1em);
            direction: rtl;
            min-height: 0;
            overflow-y: scroll;
            overflow-x: auto;
            display: flex;
            flex-flow: column;
        }
        div.content {
            direction: ltr;
            min-height: 0;
            flex: 1 0 auto;
        }
        div.handle { cursor: move; }
        :host {
            border-top: 2px solid var(--omnino-border-color, black);
            display: flex;
            flex-flow: column;
        }
        :host(:first-of-type) {
            border-top: none;
        }
        `;
        shadow.appendChild(style);

        const omninowin = this;
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
                    const omninocol = omninowin.parentElement;
                    const app = omninocol.parentElement;
                    const apprect = app.getBoundingClientRect();
                    // console.log(`App left: ${apprect.left}`);
                    const colrect = omninocol.getBoundingClientRect();
                    const winrect = omninowin.getBoundingClientRect();
                    // console.log(`Source column left: ${colrect.left}`);
                    // console.log(`Mouse X: ${mouseDownEvent.clientX}`);
                    // The position of the column relative to the OmninoApplication.
                    const oldWindowY = winrect.top - apprect.top;
                    // The position of the mousedown event relative to the OmninoApplication.
                    // const mouseDownX = mouseDownEvent.clientX - apprect.left;
                    // The x displacement from the top-left corner of the column to the mouse.
                    const mouseOffsetX = mouseDownEvent.clientX - winrect.left; //x position within the element.
                    const mouseOffsetY = mouseDownEvent.clientY - winrect.top; //x position within the element.
                    // console.log(`Mouse offset X: ${mouseOffsetX}`);

                    // Store the offset in the parent to be used by its mouseup handler.
                    //app.setMouseOffset({x: x, y: y});
                    app.style.cursor = "move";
                    app.style.userSelect = "none";

                    // TODO: Add mouseup handler
                    const cancelWindowMovement = event => {
                        app.removeEventListener("mouseup", moveWindows);
                        app.style.cursor = "default";
                        app.style.userSelect = "auto";
                        app.removeEventListener("mouseleave", cancelWindowMovement);
                    };
                    const moveWindows = mouseUpEvent => {
                        // Compute the position of the mouse event relative to OmninoApplication.
                        const rect = mouseUpEvent.currentTarget.getBoundingClientRect();
                        const dy = mouseUpEvent.clientY - mouseDownEvent.clientY;
                        // x is the horizontal position of the mouseup event relative to the omnino-app
                        const x = clamp(0, mouseUpEvent.clientX - rect.left - mouseOffsetX); //x position within the element, offset by the mouse.
                        // y is the vertical position of the mouseup event relative to the omnino-app
                        const y = mouseUpEvent.clientY - rect.top - mouseOffsetY;

                        const minHeight = app.minColumnWidth;
                        const columnHeight = omninocol.getHeight();

                        // Determine in which column and window the mouseup event occured.
                        let dstcol = app.children[0];
                        for (let i = 0, w = 0; i < app.children.length && w < x; ++i) {
                            dstcol = app.children[i];
                            const r = dstcol.getBoundingClientRect();
                            w += r.width;
                        }
                        console.assert(dstcol !== null);
                        console.log("Target Column:", dstcol);

                        let dstwin = null;
                        for (let i = 0, h = 0; i < dstcol.children.length && h < y; ++i) {
                            dstwin = dstcol.children[i];
                            const r = dstwin.getBoundingClientRect();
                            h += r.height;
                        }
                        console.log("Target Window:", dstwin);

                        const srccol = omninocol;
                        const srcwin = omninowin;
                        const srcleft = srcwin.previousElementSibling;
                        const srcright = srcwin.nextElementSibling;
                        const isResize = (dstcol === srccol && (srcwin === dstwin || (srcleft !== null && dstwin === srcleft)));
                        const isMove = (dstcol !== srccol);
                        
                        if (isResize) {
                            const shrinkwin = (dy < 0) ? srcleft : srcwin;
                            const growwin = (dy < 0) ? srcwin : srcleft;
                            if (shrinkwin !== null && growwin !== null) {
                                const shrinkidx = elementIndex(shrinkwin);
                                const growidx = elementIndex(growwin);
    
                                // a is the position of the previous window relative to the omnino-app
                                const a = srcleft.getBoundingClientRect().top - rect.top;
                                // b is the position of srcwin's bottom edge relative to the omnino-app
                                const b = srcwin.getBoundingClientRect().top - rect.top + srcwin.getBoundingClientRect().height;
                                const newWindowY = clamp(a + minHeight, y, b - minHeight);
                                if (newWindowY !== undefined) {
                                    const dy = oldWindowY - newWindowY;
                                    // console.log(`Dx: ${dx}`);
                                
                                    // Grow and shrink columns by dx
                                    const heightPct = fixPrecision(Math.abs(dy * 100 / columnHeight));
                                    omninocol.windows[shrinkidx] = fixPrecision(omninocol.windows[shrinkidx] - heightPct);
                                    omninocol.windows[growidx] = fixPrecision(omninocol.windows[growidx] + heightPct);
                                }
                            }
                        } else if (isMove) {
                            const destinationColumnIsEmpty = (dstwin === null);
                            if (destinationColumnIsEmpty) {
                                omninowin.removeWindow();
                                dstcol.addWindow(omninowin);
                            } else {
                                omninowin.removeWindow();
                                // TODO: Insert the window among the others in dstcol.
                                // TODO: Find a suitable position between the top and bottom of dstwin
                                // a is the position of dstwin's top edge relative to the omnino-app
                                const a = dstwin.getBoundingClientRect().top;
                                // b is the position of dstwin's bottom edge relative to the omnino-app
                                const b = dstwin.getBoundingClientRect().top + dstwin.getBoundingClientRect().height;
                                const mid = clamp(a + minHeight, y, b - minHeight);
                                if (mid !== undefined) {
                                    const dy = mid - a;
                                    const heightPct = fixPrecision(Math.abs(dy * 100 / columnHeight));
                                    const dstidx = elementIndex(dstwin);
                                    const oldDstWindowHeightPct = dstcol.windows[dstidx];
                                    // Set dstwin's height to mid - a as a percentage of the column's window container
                                    dstcol.windows[dstidx] = fixPrecision(heightPct);
                                    // TODO: srcwin's height is set to b - mid as a percentage of the column's window container
                                    dstcol.windows.splice(dstidx+1, 0, fixPrecision(oldDstWindowHeightPct - heightPct));
                                    // TODO: srcwin is inserted after dstwin
                                    this.ismoving = true;
                                    dstcol.insertBefore(srcwin, dstwin.nextElementSibling);
                                    this.ismoving = false;
                                }
                            }
                        } else {
                            const neighborcol = srcleft ? srcleft : (srcright ? srcright : null);

                            const srcidx = elementIndex(srccol);
                            const dstidx = elementIndex(dstcol);
                            const neighboridx = neighborcol ? elementIndex(neighborcol) : -1;

                            // TODO: Find x coordinate of moved column's new position
                            const oldSrcColumnWidthPct = app.columns[srcidx];
                            const oldDstColumnWidthPct = app.columns[dstidx];
                            const a = dstcol.offsetLeft - apprect.left;
                            const b = dstcol.offsetLeft - apprect.left + dstcol.offsetWidth;
                            const newColumnX = clamp(a + minWidth, x, b - minWidth);
                            if (newColumnX !== undefined) {
                                // Make room for the source column in the dest column and grow the neighbor column
                                const newSrcColumnWidth = b - newColumnX;
                                const newSrcColumnWidthPct = fixPrecision(Math.abs(newSrcColumnWidth * 100 / appWidth));
                                const newDstColumnWidthPct = fixPrecision(oldDstColumnWidthPct - newSrcColumnWidthPct);
                                app.columns[srcidx] = newSrcColumnWidthPct;
                                app.columns[dstidx] = newDstColumnWidthPct;
                                if (neighboridx >= 0) {
                                    app.columns[neighboridx] = fixPrecision(app.columns[neighboridx] + oldSrcColumnWidthPct);
                                }
                                // app.columns[srcidx] = newSrcColumnWidthPct;
                                // Move source column after dest column
                                const moveElement = (arr, i, j) => {
                                    const elt = arr[i];
                                    arr.splice(i, 1);
                                    arr.splice((i < j) ? j-1 : j, 0, elt);
                                }
                                moveElement(app.columns, srcidx, dstidx+1);
                                // app.columns = app.columns.map((elt, i, arr) => {
                                //     if 
                                // });
                                // app.columns.splice(dstidx+1, 0, newSrcColumnWidthPct);
                                // app.columns.splice(srcidx, 1);
                                this.ismoving = true;
                                app.insertBefore(srccol, dstcol.nextElementSibling);
                                this.ismoving = false;
                            }
                        }
                        omninocol.updateWindows();
                        dstcol.updateWindows();
                        cancelWindowMovement(event);
                    };
                    app.addEventListener("mouseup", moveWindows);
                    app.addEventListener("mouseleave", cancelWindowMovement);
                });
                header.appendChild(handle);

                const nav = document.createElement("nav");
                {
                    // const title = document.createElement("h2");
                    // nav.appendChild(title);
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

const offset = (elt) => {
    let top = 0, left = 0;
    do {
        top += elt.offsetTop  || 0;
        left += elt.offsetLeft || 0;
        elt = elt.offsetParent;
    } while (elt);

    return {
        x: left,
        y: top,
    };
};

const defaultColumnDelegate = () => {
    const addWindow = () => {
        const win = col.addWindow();
        win.setContent(elts);
        return win;
    };
    const self = {
        getMenu: (column) => {
            return [
                {
                    title: "Newwin",
                    link: addWindow.bind(this),
                },
                {
                    title: "Delcol",
                    link: this.removeColumn.bind(this),
                },
            ]
        },
    };
};

const defaultAppDelegate = () => {
    const addColumn = (app) => {
        const col = app.addColumn();
        if (col !== null) {
            const colMenu = col.getMenu();
            colMenu[0].link = 
            col.setMenu(colMenu);
        }
        return col;
    };
    const self = {
        getMenu: (app) => {
            return [
                {
                    title: "Newcol",
                    link: addColumn.bind(null, app),
                },
                {
                    title: "Help",
                    link: "/",
                },
            ];
        },
    };
};

const install = (container) => {
    const app = document.createElement('omnino-app');
    container.appendChild(app);
    const proxy = makeApplicationProxy(app);
    return proxy;
};

const clone = (elt) => {

}

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
