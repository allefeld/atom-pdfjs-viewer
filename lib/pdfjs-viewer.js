'use babel'

import PdfjsViewerView from './pdfjs-viewer-view'
import { CompositeDisposable } from 'atom'

export default {

  'config': {
    'disableValidation': {
      'title': 'Disable URL Validation',
      'description': `The PDF.js viewer by default prevents files to be loaded
        from hosts different from the viewer's. For this package, it prevents
        to load PDFs from anywhere but the local disk. This setting disables
        validation, allowing files to be loaded from any URL.`,
      'type': 'boolean',
      'default': 'true'
    },
    'synctexPath': {
      'title': 'Path to SyncTeX binary',
      'description': `Used for reverse lookup, if the PDF has been generated
        by *TeX with SyncTeX.`,
      'type': 'string',
      'default': 'synctex'
    }
  },

  subscriptions: null,

  activate() {
    this.subscriptions = new CompositeDisposable()

    // add opener for PDFs to workspace
    this.subscriptions.add(
      atom.workspace.addOpener(uri => {
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
