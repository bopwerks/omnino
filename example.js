window.addEventListener("load", () => {
    const setup = (app, elts, title) => {
        // Move the elements to a top-level div to simplify cloning.
        const root = document.createElement("div");
        elts.forEach(elt => root.appendChild(elt));
        
        // Creating a new window
        let nwindows = 0;
        const makeNewWindowFunc = (column, elts) => {
            return () => {
                const win = column.addWindow();
                if (win !== null) {
                    win.setTitle(`${title} ${++nwindows}`);
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
    
    const body = document.querySelector("body");
    console.assert(body);
    const elts = removeElements(body);
    const app = setup(omnino.install(body), elts, document.title);
});
