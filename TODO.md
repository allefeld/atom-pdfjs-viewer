# todo

-   minimize and mark changes `viewer.css`

-   disable interfering keyboard shortcuts (^S, ...) or keep them from Atom.  
    <https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#faq-shortcuts>  
    make optional?

-   make hiding useless UI elements optional

-   option to open external links with `atom.workspace.open`  
    instead of `shell.openExternal`

-   make watch & autoreload optional?  
    If it's optional, Pandoc/PDF cannot rely on it.
    So we still need `updatePdf()`. Does this hurt performance?
