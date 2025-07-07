import SwiftUI

struct ThreadDisplayView: View {
    let thread: EmailThread
    let mailService: MailService
    @EnvironmentObject var themeManager: ThemeManager
    @Environment(\.presentationMode) var presentationMode
    
    @State private var expandedMessages: Set<String> = []
    
    var body: some View {
        NavigationView {
            ZStack {
                themeManager.backgroundColor
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    headerView
                    
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(thread.messages) { message in
                                MessageView(
                                    message: message,
                                    isExpanded: expandedMessages.contains(message.id),
                                    themeManager: themeManager,
                                    onToggleExpand: {
                                        if expandedMessages.contains(message.id) {
                                            expandedMessages.remove(message.id)
                                        } else {
                                            expandedMessages.insert(message.id)
                                        }
                                    }
                                )
                                
                                if message.id != thread.messages.last?.id {
                                    Divider()
                                        .background(themeManager.offsetColor)
                                        .padding(.horizontal, 16)
                                }
                            }
                        }
                    }
                    
                    bottomToolbar
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            if let firstMessage = thread.messages.first {
                expandedMessages.insert(firstMessage.id)
            }
        }
    }
    
    private var headerView: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    presentationMode.wrappedValue.dismiss()
                }) {
                    Image(systemName: "chevron.left")
                        .foregroundColor(themeManager.iconColor)
                        .font(.title2)
                }
                
                Spacer()
                
                VStack(spacing: 2) {
                    Text(thread.subject)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundColor(themeManager.primaryTextColor)
                        .lineLimit(1)
                    
                    Text("\(thread.messageCount) message\(thread.messageCount == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(themeManager.secondaryTextColor)
                }
                
                Spacer()
                
                Button(action: {
                    Task {
                        await mailService.toggleStar(threadId: thread.id)
                    }
                }) {
                    Image(systemName: thread.isStarred ? "star.fill" : "star")
                        .foregroundColor(thread.isStarred ? .yellow : themeManager.iconColor)
                        .font(.title2)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(themeManager.panelColor)
        }
    }
    
    private var bottomToolbar: some View {
        HStack(spacing: 24) {
            Button(action: {
                
            }) {
                VStack(spacing: 4) {
                    Image(systemName: "archivebox")
                        .font(.title2)
                    Text("Archive")
                        .font(.caption2)
                }
                .foregroundColor(themeManager.iconColor)
            }
            
            Button(action: {
                
            }) {
                VStack(spacing: 4) {
                    Image(systemName: "trash")
                        .font(.title2)
                    Text("Delete")
                        .font(.caption2)
                }
                .foregroundColor(themeManager.iconColor)
            }
            
            Button(action: {
                
            }) {
                VStack(spacing: 4) {
                    Image(systemName: "arrowshape.turn.up.left")
                        .font(.title2)
                    Text("Reply")
                        .font(.caption2)
                }
                .foregroundColor(themeManager.accentColor)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(themeManager.panelColor)
    }
}

struct MessageView: View {
    let message: EmailMessage
    let isExpanded: Bool
    let themeManager: ThemeManager
    let onToggleExpand: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggleExpand) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(message.displayName)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(themeManager.primaryTextColor)
                                .lineLimit(1)
                            
                            Spacer()
                            
                            Text(formatDate(message.date))
                                .font(.caption)
                                .foregroundColor(themeManager.secondaryTextColor)
                        }
                        
                        if !isExpanded {
                            Text(message.preview)
                                .font(.caption)
                                .foregroundColor(themeManager.secondaryTextColor)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    
                    VStack(spacing: 8) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(themeManager.iconColor)
                            .font(.caption)
                        
                        if message.isStarred {
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                                .font(.caption)
                        }
                        
                        if !message.isRead {
                            Circle()
                                .fill(themeManager.accentColor)
                                .frame(width: 6, height: 6)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .buttonStyle(PlainButtonStyle())
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("From:")
                            .font(.caption)
                            .foregroundColor(themeManager.secondaryTextColor)
                        
                        Text(message.sender.email)
                            .font(.caption)
                            .foregroundColor(themeManager.primaryTextColor)
                        
                        Spacer()
                    }
                    
                    HStack {
                        Text("To:")
                            .font(.caption)
                            .foregroundColor(themeManager.secondaryTextColor)
                        
                        Text(message.to.map { $0.email }.joined(separator: ", "))
                            .font(.caption)
                            .foregroundColor(themeManager.primaryTextColor)
                            .lineLimit(2)
                        
                        Spacer()
                    }
                    
                    if let cc = message.cc, !cc.isEmpty {
                        HStack {
                            Text("CC:")
                                .font(.caption)
                                .foregroundColor(themeManager.secondaryTextColor)
                            
                            Text(cc.map { $0.email }.joined(separator: ", "))
                                .font(.caption)
                                .foregroundColor(themeManager.primaryTextColor)
                                .lineLimit(2)
                            
                            Spacer()
                        }
                    }
                    
                    Divider()
                        .background(themeManager.offsetColor)
                    
                    Text(message.body)
                        .font(.body)
                        .foregroundColor(themeManager.primaryTextColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    if let attachments = message.attachments, !attachments.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Attachments")
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(themeManager.primaryTextColor)
                            
                            ForEach(attachments) { attachment in
                                AttachmentView(attachment: attachment, themeManager: themeManager)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
        .background(themeManager.panelColor)
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct AttachmentView: View {
    let attachment: EmailAttachment
    let themeManager: ThemeManager
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconForMimeType(attachment.mimeType))
                .foregroundColor(themeManager.iconColor)
                .font(.title2)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.filename)
                    .font(.subheadline)
                    .foregroundColor(themeManager.primaryTextColor)
                    .lineLimit(1)
                
                Text(formatFileSize(attachment.size))
                    .font(.caption)
                    .foregroundColor(themeManager.secondaryTextColor)
            }
            
            Spacer()
            
            Button(action: {
                
            }) {
                Image(systemName: "square.and.arrow.down")
                    .foregroundColor(themeManager.accentColor)
                    .font(.title3)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(themeManager.offsetColor)
        .cornerRadius(8)
    }
    
    private func iconForMimeType(_ mimeType: String) -> String {
        if mimeType.hasPrefix("image/") {
            return "photo"
        } else if mimeType.hasPrefix("video/") {
            return "video"
        } else if mimeType.hasPrefix("audio/") {
            return "music.note"
        } else if mimeType.contains("pdf") {
            return "doc.text"
        } else if mimeType.contains("zip") || mimeType.contains("archive") {
            return "archivebox"
        } else {
            return "doc"
        }
    }
    
    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

struct ThreadDisplayView_Previews: PreviewProvider {
    static var previews: some View {
        let mockSender = EmailSender(name: "John Doe", email: "john@example.com")
        let mockMessage = EmailMessage(
            id: "msg-1",
            threadId: "thread-1",
            subject: "Test Subject",
            body: "This is a test message body.",
            sender: mockSender,
            to: [EmailSender(name: "You", email: "you@zero.email")],
            cc: nil,
            bcc: nil,
            date: Date(),
            isRead: false,
            isStarred: true,
            isImportant: false,
            labels: [],
            attachments: nil
        )
        
        let mockThread = EmailThread(
            id: "thread-1",
            messages: [mockMessage],
            subject: "Test Subject",
            participants: [mockSender],
            lastMessageDate: Date(),
            isRead: false,
            isStarred: true,
            isImportant: false,
            messageCount: 1
        )
        
        ThreadDisplayView(thread: mockThread, mailService: MailService())
            .environmentObject(ThemeManager())
    }
}
