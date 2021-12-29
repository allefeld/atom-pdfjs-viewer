'use babel'

import PdfjsViewerView from './pdfjs-viewer-view'
import { CompositeDisposable } from 'atom'

export default {

  'config': {
    'disableValidation': {
      'title': 'Disable URL Validation',
      'description': 'The PDF.js viewer by default prevents files to be loaded from hosts different from the viewer\'s. For this package, it prevents to load PDFs from anywhere but the local disk. This setting disables validation, allowing files to be loaded from any URL.',
      'type': 'boolean',
      'default': 'true'
    },
    'overrideFingerprint': {
      'title': 'Override PDF ID',
      'description': 'When a PDF is loaded in an existing viewer, PDF.js compares the ID embedded in the PDF (it\'s "fingerprint") with the previous one and resets the view (position, zoom, etc.) if they are different. This can happen even for the "same" document if it is dynamically regenerated, e.g. by LaTeX. If this option is checked, the PDF ID is overwritten by the pathname of the document, so view properties should stay the same as long as the pathname stays the same. __experimental__',
      'type': 'boolean',
      'default': 'false'
    },
    'invertColors': {
      'title': 'Invert PDF colors',
      'description': 'This is intended to provide a better match for dark UI themes. Needs reload of the PDF viewer tab.',
      'type': 'boolean',
      'default': 'false'
    },
    'synctexPath': {
      'title': 'Path to SyncTeX binary',
      'description': 'Used for reverse lookup, if the PDF has been generatedby *TeX with SyncTeX.',
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
