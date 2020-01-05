'use babel'

import PdfjsViewerView from './pdfjs-viewer-view'
import { CompositeDisposable } from 'atom'

export default {

  subscriptions: null,

  activate() {
    this.subscriptions = new CompositeDisposable()

    // add opener for PDFs to workspace
    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
        console.log(uri)
        if (uri.endsWith('.pdf')) {
          return new PdfjsViewerView(uri)
        }
      })
    )
  },

  deactivate() {
    this.subscriptions.dispose()
  },
  
  deserializeView(state) {
    return new PdfjsViewerView(state.data)
  }

}
