# Omnino

Omnino is a windowing system for web applications, inspired by the Acme text editor. It divides the display, or a portion of it, into columns and windows which may be created, deleted, resized, and reordered. A [live demo](https://bopwerks.github.io/omnino/) is available.

![Screenshot](screenshot.png?raw=true "Screenshot")

## Customization

CSS variables control visual aspects of Omnino. An example follows.

```css
:root {
    /* The title text which is displayed in the top-left of the Omnino container. */
    --omnino-title: "My Website";

    /* The color of an empty Omnino column. */
    --omnino-background-color: #151515;

    /* The color of the border which separates Omnino columns and window. */
    --omnino-border-color: rgb(54, 54, 54);

    /* The background color of Omnino's menus. */
    --omnino-menu-background: #252526;

    /* The foreground text color of Omnino's menus. */
    --omnino-menu-fgcolor: #858585;

    /* The background color of Omnino's menu items when the mouse hovers over them. */
    --omnino-link-hover-color: #1c1c1c;

    /* The background color of Omnino's menu items when the mouse is pressed over them. */
    --omnino-link-active-color: #101010;

    /* The color of the handle used to reposition columns and windows. */
    --omnino-handle-color: #569cd6;
}
```
