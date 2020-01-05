'use babel'

import path from 'path'
import { CompositeDisposable } from 'atom'
import shell from 'shell'
import fs from 'fs'


export default class PdfjsViewerView {

  constructor(pathname) {
view = this //HACK
    // collect disposables
    this.subscriptions = new CompositeDisposable()
    
    // remember pathname of PDF
    this.pdfPathname = pathname
    
    // parse pathname into parts
    this.pathnameParts = path.parse(pathname)
    
    // path for (modified) PDF.js viewer.html
    const viewerPathname = path.join(
      atom.packages.getLoadedPackage('pdfjs-viewer').path,
      'pdfjs', 'web', 'viewer.html')
    
    // create iframe as root element of view
    this.element = document.createElement('iframe')
    this.element.classList.add('pdfjs-viewer')
    this.element.src = viewerPathname + '?file=' + pathname
    
    // finish initialization when PDF viewer is loaded
    this.element.addEventListener("load", () => this.viewerLoaded())
    
    // watch for changes of PDF file
    if (fs.existsSync(this.pdfPathname)) {
      this.fswatcher = fs.watch(this.pdfPathname,
        (eventType) => this.handleFilechange(eventType))
    } else {
      this.fswatcher = null
    }
  }
  
  
  // finish initialization
  viewerLoaded() {
    // inject style
    this.injectStyle()
    
    // inject style again when theme changed
    this.subscriptions.add(
      atom.themes.onDidChangeActiveThemes(() => this.injectStyle())
    )
    
    // make external links functional
    this.element.contentWindow.addEventListener("click",
      (event) => this.handleLink(event))
  }
  
  
  // compile the viewer-specific LESS into CSS
  // and inject it into the viewer iframe's style element
  injectStyle() {
    const lessFile = path.join(
      atom.packages.getLoadedPackage('pdfjs-viewer').path,
      'pdfjs', 'web', 'viewer.less')
    const css = atom.themes.loadLessStylesheet(lessFile)
    this.element.contentDocument.getElementById('viewer-less').innerText = css
  }
  
  
  // handle changes to PDF file
  handleFilechange(eventType) {
    if (eventType == 'change') {
      this.reloadPdf()
    } else {
      // don't continue watching a file that has been renamed
      this.fswatcher.close()
      this.fswatcher = null
    }
    
  }
  
  
  // handle clicks on external links
  handleLink(event) {
    // only left click, no modifiers, on 'a' element with '_top' target
    // 'meta' is not actually detected, and 'alt' clicks never make it here
    if ((event.button == 0) &&
        !event.ctrlKey && !event.shiftKey &&
        // !event.altKey && !event.metaKey &&
        (event.target.tagName == 'A') && (event.target.target == '_top')) {
      // open externally
      shell.openExternal(event.target.href)
    }
  }


  // reload PDF file
  reloadPdf() {
    const window = this.element.contentWindow
    if (window) {
      console.log('PdfjsViewerView: reloading PDF')
      window.PDFViewerApplication.open(this.pdfPathname)
    } else {
      console.log('PdfjsViewerView: cannot (yet) reload PDF')
    }
  }
  
  
  serialize() {
    return {
      deserializer: 'PdfjsViewerView',
      data: this.pdfPathname
    }
  }
  
  
  destroy() {
    if (this.fswatcher) {
      this.fswatcher.close()
    }
    this.subscriptions.dispose()
    this.element.remove()
  }


  getElement() {
    return this.element
  }
  
  
  getTitle() {
    return this.pathnameParts.base
  }
  
  
  getURI() {
    return this.pdfPathname
  }

}
