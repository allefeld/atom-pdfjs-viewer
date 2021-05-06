'use babel'

import path from 'path'
import { CompositeDisposable } from 'atom'
import { shell } from 'electron'  // deprecated: import shell from 'shell'
import fse from 'fs-extra'
import chokidar from 'chokidar'
import { BufferedProcess } from 'atom'


export default class PdfjsViewerView {

  constructor(pathname) {
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
    this.element.addEventListener('load', () => this.viewerLoaded())
  }


  // finish initialization
  viewerLoaded() {
    // ensure containing directory exists, so that watching works
    fse.ensureDirSync(this.pathnameParts.dir)
    // watch for changes of PDF file
    console.log('watching for ' + this.pdfPathname)
    this.fswatcher = chokidar.watch(this.pdfPathname)
    this.fswatcher.on('add', (path) => this.handleFilechange('add', path))
    this.fswatcher.on('change', (path) => this.handleFilechange('change', path))
    console.log(this.fswatcher)

    // inject style
    this.injectStyle()

    // inject style again when theme changed
    this.subscriptions.add(
      atom.themes.onDidChangeActiveThemes(() => this.injectStyle())
    )

    // make external links functional
    this.element.contentWindow.addEventListener('click',
      (event) => this.handleLink(event))

    // control keyboard shortcuts
    this.element.contentWindow.addEventListener('keydown',
      (event) => this.handleKey(event), true)

    // control printing
    //   Ctrl-P doesn't even reach the keydown event listener.
    // Instead, we have to override the print function:
    this.element.contentWindow.print = () => this.handlePrint()

    // SyncTeX through right-click
    this.element.contentWindow.addEventListener('contextmenu',
      (event) => this.handleSynctex(event))
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


  // handle keypresses
  //   To suppress keypresses being handled by the PDF.js viewer,
  // two things are necessary:
  // 1) above: ….contentWindow.addEventListener('keydown', …, true)
  // 2) here: event.stopPropagation()
  // This lets Atom's keypress handler take over.
  //   To instead suppress Atom's handling, use event.preventDefault().
  handleKey(event) {
    switch (event.keyCode) {
      case 83:      // suppress (Shift-)Ctrl-S → PDF.js Save
        if (event.ctrlKey) {
          event.stopPropagation()
        }
        break;
      case 115:
        if (!event.ctrlKey && !event.shiftKey) {
          event.preventDefault()
        }
        break;
    }
  }


  // handle print requests
  handlePrint() {
    console.log('PdfjsViewerView.handlePrint')
    // For now, instead of printing, we simulate the effect Ctrl-P would have
    // had on the HTML element containing the PDF viewer.
    const container = this.element.parentElement
    //   get Atom command from keystroke
    const command = atom.keymaps.findKeyBindings(
      {keystrokes: 'ctrl-p', target: container})[0].command
    // dispatch Atom command
    atom.commands.dispatch(container, command)
  }


  // determine page position of mouse click,
  // and call SyncTeX to obtain (La-)TeX source line number
  handleSynctex(event) {
    // get enclosing page div
    const page = event.target.closest('div.page')
    if (!page) {
      return
    }
    // get page number
    const pageNo = parseInt(page.getAttribute('data-page-number'), 10)
    if (isNaN(pageNo)) {
      return
    }
    // compute mouse coordinates relative to canvas element
    // taking rotation into account
    const bounds = page.querySelector('canvas').getBoundingClientRect();
    const rot = this.element.contentWindow.PDFViewerApplication.
      pdfViewer.pagesRotation
    switch (rot) {
      case 0:
        var x = event.clientX - bounds.left
        var y = event.clientY - bounds.top
        break;
      case 90:
        var x = event.clientY - bounds.top
        var y = bounds.right - event.clientX
        break;
      case 180:
        var x = bounds.right - event.clientX
        var y = bounds.bottom - event.clientY
        break;
      case 270:
        var x = bounds.bottom - event.clientY
        var y = event.clientX - bounds.left
        break;
    }
    // get PDF view resolution, assuming that currentScale is relative to a
    // fixed browser resolution of 96 dpi; see viewer.js line 3390.
    const res = this.element.contentWindow.PDFViewerApplication.
      pdfViewer.currentScale * 96
    // compute coordinates in points (TeX bp)
    x = Math.round(x / res * 72)
    y = Math.round(y / res * 72)

    // call SyncTeX
    const command = atom.config.get('pdfjs-viewer.synctexPath')
    const args = [
      'edit',
      '-o',
      pageNo + ':' + x + ':' + y + ':' + this.pdfPathname
    ]
    var synctex = {}  // to collect SyncTeX output values
    const stdout = (output) => this.synctexStdout(output, synctex)
    const exit = (code) => this.synctexExit(code, synctex)
    new BufferedProcess({command, args, stdout, exit}).
      onWillThrowError((errorObject) => {
        errorObject.handle()
        atom.notifications.addError('Could not run SyncTeX',
          {description: 'Make sure `' + command +
            '` is installed and on your PATH'})
      })
    console.log('PdfjsViewerView: ' + command + ' ' + args.join(' '))
  }

  // parse SyncTeX output for values
  synctexStdout (output, synctex){
    // split buffered lines
    lines = output.split('\n')
    for (let line of lines) {
      if (line.startsWith('Input:')) {
        synctex.input = line.substr(6)
        if (process.platform == 'win32') {
          // attempt to fix issue #6
          synctex.input = synctex.input.replace('\\', '/')
        }
      }
      if (line.startsWith('Line:')) {
        let value = line.substr(5)
        synctex.line = parseInt(value, 10)
      }
    }
  }

  // upon SyncTeX exit, open source file at line number
  synctexExit(code, synctex) {
    if (code == 0) {
      console.log('PdfjsViewerView: Opening SyncTeX result: line '
        + synctex.line + ' of ' + synctex.input)
      atom.workspace.open(synctex.input, {
        initialLine: synctex.line - 1,
        searchAllPanes: true
      })
    } else {
      console.log('PdfjsViewerView: SyncTeX failed with code ' + code)
    }
  }

  // handle changes to PDF file
  handleFilechange(event, path) {
    console.log('PdfjsViewerView: file', event, path)
    this.reloadPdf()
  }


  // reload PDF file
  reloadPdf() {
    const win = this.element.contentWindow
    if (win) {
      console.log('PdfjsViewerView: reloading PDF')
      // // I worked so hard to keep the PDF ID constant, but yet still sometimes
      // // on reload the PDF gets scrolled back to the top. Well, let's hack it.
      //  var vc = this.element.contentDocument.getElementById('viewerContainer')
      //  const scrollTop = vc.scrollTop
      //  const scrollLeft = vc.scrollLeft
      // Appears to have been solved by changing the file watcher,
      // left here for future reference in case not.
      //  win.PDFViewerApplication.eventBus.on('documentinit', (e) => console.log(e))
      win.PDFViewerApplication.close()
      win.PDFViewerApplication.open(this.pdfPathname)
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
      this.fswatcher.unwatch(this.pdfPathname)
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


  getPreferredWidth() {
    // half the window width, or 844 pixels, whichever is smaller
    //   844 pixels is the smallest pane width at which a Letter-format page
    // (slightly wider than A4) displayed at 100% does not lead to horizontal
    // scrolling.
    return Math.min(Math.floor(atom.windowDimensions.width / 2), 844)
  }
}
