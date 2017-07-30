import { observable, computed } from 'mobx'
import { assign, findIndex } from 'lodash'
import pluginCall from 'sketch-module-web-view/client'
import bridgedFunctionCall from '../../../bridge/client'
import { IssueMapper, AttachmentsMapper } from './mapper'
import { analytics } from './util'

const _touchIssueAndReloadAttachments = bridgedFunctionCall(
  'touchIssueAndReloadAttachments', IssueMapper
)
const _getDroppedFiles = bridgedFunctionCall('getDroppedFiles', AttachmentsMapper)

export default class Issue {
  @observable attachments = []
  @observable commentText = ''
  @observable postingComment = false
  @observable postedCommentHref = null

  constructor (issue, attachments) {
    assign(this, issue)
    this.attachments.replace(attachments)
  }

  async onSelected () {
    const issue = await _touchIssueAndReloadAttachments(this.key)
    // convert from @observable array to real array TODO this could be nicer!
    const newAttachments = [].slice.call(issue.attachments)
    // retain attachments that are currently uploading
    this.attachments.replace(
      this.attachments.filter(attachment => {
        return attachment.uploading
      }).concat(newAttachments)
    )
    analytics('viewIssue')
  }

  async uploadDroppedFiles () {
    const droppedFiles = await _getDroppedFiles()
    droppedFiles.forEach(file => {
      this.attachments.unshift(file)
      file.upload()
    })
  }

  indexOfAttachment (attachmentId) {
    return findIndex(this.attachments, attachment => {
      return attachment.id === attachmentId
    })
  }

  @computed get browseUrl () {
    var baseUrl = this.self.substring(0, this.self.indexOf('/rest/'))
    return `${baseUrl}/browse/${this.key}`
  }

  openInBrowser () {
    pluginCall('openInBrowser', this.browseUrl)
    analytics('viewIssueOpenInBrowser')
  }

  openPostedCommentInBrowser () {
    if (this.postedCommentHref) {
      pluginCall('openInBrowser', this.postedCommentHref)
      analytics('viewIssueOpenCommentInBrowser')
    }
  }

  postComment () {
    if (!this.postingComment && this.commentText.trim()) {
      this.postingComment = true
      this.postedCommentHref = null
      pluginCall('addComment', this.key, this.commentText)
    }
  }

  onCommentAdded (href) {
    this.commentText = ''
    this.postingComment = false
    this.postedCommentHref = href
  }
}