import { tempDir, localPathToNSURLString, documentFromContext } from './util'
import { analytics } from './analytics'
import { trace, error } from './logger'
import { layerLastExportedIssue, documentLastViewedIssue } from './properties'

const badFilenameChars = new RegExp('/', 'g')

/**
 * Exports the currently selected layers to a temp directory, using the layers'
 * configured export settings.
 *
 * @param {Object} context provided by Sketch
 * @param {string} issueKey identifies the issue the layers will be exported to
 * @return {string[]} the exported paths
 */
export function exportSelection (context, issueKey) {
  const dir = tempDir(`export-${Date.now()}`)
  const exportedPaths = []
  let layerCount = 0
  withDocument(context, document => {
    forEachSelectedLayer(context, layer => {
      exportedPaths.push(...exportLayer(document, layer, dir))
      setLastExportedIssueForLayer(context, layer, issueKey)
      layerCount++
    })
  })
  trace(`Exporting ${exportedPaths.length} assets to ${dir}`)
  if (layerCount > 1) {
    analytics('exportSelectedLayers', { count: layerCount })
  } else {
    analytics('exportSelectedLayer')
  }
  return exportedPaths
}

/**
 * Export a layer to a particular directory using the filename suggested by
 * Sketch.
 *
 * @param {Object} document the selected document from the current Sketch context
 * @param {Object} layer a Sketch layer
 * @param {string} dir the directory to export to
 * @return {string[]} the exported paths for each slice in this layer
 */
function exportLayer (document, layer, dir) {
  const exportedPaths = []
  const slices = MSExportRequest.exportRequestsFromExportableLayer(layer)
  for (let i = 0; i < slices.count(); i++) {
    const slice = slices[i]
    const filepath = dir + nameForSlice(slice)
    document.saveArtboardOrSlice_toFile(slice, filepath)
    exportedPaths.push(localPathToNSURLString(filepath))
  }
  if (exportedPaths.length > 1) {
    analytics('exportMultipleFormats', {count: exportedPaths.length})
  } else {
    analytics('exportSingleFormat')
  }
  return exportedPaths
}

/**
 * @param {Object} slice a Sketch export request (generated by MSExportRequest)
 * @return {string} a suitable filename for the slice
 */
function nameForSlice (slice) {
  return `${encodeLayerNameAsFilename(slice.name())}.${slice.format()}`
}

/**
 * @param {string} layerName the layer's name
 * @return {string} a new filesystem-safe layer name
 */
function encodeLayerNameAsFilename (layerName) {
  return layerName.replace(badFilenameChars, '_')
}

/**
 * @param {Object} context provided by Sketch
 * @param {Object} layer a Sketch layer
 * @param {string} issueKey identifies the issue the layers was or will be
 * exported to
 */
function setLastExportedIssueForLayer (context, layer, issueKey) {
  context.command.setValue_forKey_onLayer(issueKey, layerLastExportedIssue, layer)
}

/**
 * @param {Object} context provided by Sketch
 * @return {string} the last exported to issue from one of the layers in the
 * user's current selection. If there are multiple last exported issues, the
 * one from the first layer in the user's selection is returned
 */
export function getLastExportedIssueForSelectedLayers (context) {
  let issueKey = null
  forEachSelectedLayer(context, layer => {
    issueKey = issueKey || context.command.valueForKey_onLayer(layerLastExportedIssue, layer)
  })
  return issueKey ? issueKey + '' : null
}

/**
 * @param {Object} context provided by Sketch
 * @param {string} issueKey identifies the issue that was last exported to for
 * the current document
 */
export function setLastViewedIssueForDocument (context, issueKey) {
  withDocument(context, document => {
    context.command.setValue_forKey_onDocument(
      issueKey,
      documentLastViewedIssue,
      document.documentData()
    )
  })
}

/**
 * @param {Object} context provided by Sketch
 * @return {string} the last viewed to issue for the current document
 */
export function getLastViewedIssueForDocument (context) {
  return withDocument(context, document => {
    const key = context.command.valueForKey_onDocument(
      documentLastViewedIssue,
      document.documentData()
    )
    return key ? key + '' : null
  })
}

/**
 * @param {Object} context provided by Sketch
 * @param {function} fn invoked with the current document
 * @return {*} the result of fn, or `null` if the document could not be resolved
 */
function withDocument (context, fn) {
  const document = documentFromContext(context)
  if (!document) {
    error('Couldn\'t resolve document from context')
    return
  }
  return fn(document)
}

/**
 * @param {Object} context provided by Sketch
 * @param {function} fn invoked with each layer in the user's current selection
 */
function forEachSelectedLayer (context, fn) {
  withDocument(context, document => {
    const selectedLayers = document.selectedLayers().layers()
    for (let i = 0; i < selectedLayers.count(); i++) {
      fn(selectedLayers[i])
    }
  })
}

/**
 * @param {Object} context provided by Sketch
 * @return {boolean} whether at least one layer is selected
 */
export function areLayersSelected (context) {
  let isSelected = false
  forEachSelectedLayer(context, () => { isSelected = true })
  return isSelected
}
