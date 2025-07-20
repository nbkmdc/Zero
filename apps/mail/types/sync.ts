export enum IncomingMessageType {
  UseChatRequest = 'cf_agent_use_chat_request',
  ChatClear = 'cf_agent_chat_clear',
  ChatMessages = 'cf_agent_chat_messages',
  ChatRequestCancel = 'cf_agent_chat_request_cancel',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export enum OutgoingMessageType {
  ChatMessages = 'cf_agent_chat_messages',
  UseChatResponse = 'cf_agent_use_chat_response',
  ChatClear = 'cf_agent_chat_clear',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export enum SyncActionType {
  MARK_READ = 'mark_read',
  MARK_UNREAD = 'mark_unread',
  TOGGLE_STAR = 'toggle_star',
  TOGGLE_IMPORTANT = 'toggle_important',
  MODIFY_LABELS = 'modify_labels',
  BULK_DELETE = 'bulk_delete',
  BULK_ARCHIVE = 'bulk_archive',
}
