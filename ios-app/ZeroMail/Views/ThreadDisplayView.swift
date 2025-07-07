import SwiftUI

struct ThreadDisplayView: View {
    let thread: EmailThread
    let mailService: MailService
    @EnvironmentObject var themeManager: ThemeManager
    @Environment(\.presentationMode) var presentationMode
    
    @State private var selectedMessage: EmailMessage?
    
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
                                    themeManager: themeManager,
                                    isExpanded: selectedMessage?.id == message.id || thread.messages.count == 1
                                ) {
                                    if selectedMessage?.id == message.id {
                                        selectedMessage = nil
                                    } else {
                                        selectedMessage = message
                                    }
                                }
                                
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
        HStack(spacing: 20) {
            Button(action: {
                
            }) {
                Image(systemName: "arrowshape.turn.up.left")
                    .foregroundColor(themeManager.iconColor)
                    .font(.title2)
            }
            
            Button(action: {
                
            }) {
                Image(systemName: "arrowshape.turn.up.right")
                    .foregroundColor(themeManager.iconColor)
                    .font(.title2)
            }
            
            Spacer()
            
            Button(action: {
                
            }) {
                Image(systemName: "archivebox")
                    .foregroundColor(themeManager.iconColor)
                    .font(.title2)
            }
            
            Button(action: {
                
            }) {
                Image(systemName: "trash")
                    .foregroundColor(themeManager.iconColor)
                    .font(.title2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(themeManager.panelColor)
    }
}

struct MessageView: View {
    let message: EmailMessage
    let themeManager: ThemeManager
    let isExpanded: Bool
    let onToggle: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(message.displayName)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(themeManager.primaryTextColor)
                            
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
                        }
                    }
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(themeManager.iconColor)
                        .font(.caption)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .buttonStyle(PlainButtonStyle())
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    messageDetails
                    
                    Divider()
                        .background(themeManager.offsetColor)
                    
                    messageContent
                    
                    if let attachments = message.attachments, !attachments.isEmpty {
                        attachmentsView(attachments)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
        .background(themeManager.panelColor)
    }
    
    private var messageDetails: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("From:")
                    .font(.caption)
                    .foregroundColor(themeManager.secondaryTextColor)
                
                Text(message.sender.email)
                    .font(.caption)
                    .foregroundColor(themeManager.primaryTextColor)
            }
            
            HStack {
                Text("To:")
                    .font(.caption)
                    .foregroundColor(themeManager.secondaryTextColor)
                
                Text(message.to.map { $0.email }.joined(separator: ", "))
                    .font(.caption)
                    .foregroundColor(themeManager.primaryTextColor)
                    .lineLimit(2)
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
                }
            }
            
            HStack {
                Text("Subject:")
                    .font(.caption)
                    .foregroundColor(themeManager.secondaryTextColor)
                
                Text(message.subject)
                    .font(.caption)
                    .foregroundColor(themeManager.primaryTextColor)
                    .lineLimit(2)
            }
        }
    }
    
    private var messageContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(cleanHtmlContent(message.body))
                .font(.body)
                .foregroundColor(themeManager.primaryTextColor)
                .textSelection(.enabled)
        }
    }
    
    private func attachmentsView(_ attachments: [EmailAttachment]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Attachments")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(themeManager.primaryTextColor)
            
            ForEach(attachments) { attachment in
                HStack {
                    Image(systemName: iconForMimeType(attachment.mimeType))
                        .foregroundColor(themeManager.iconColor)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(attachment.filename)
                            .font(.caption)
                            .foregroundColor(themeManager.primaryTextColor)
                        
                        Text(formatFileSize(attachment.size))
                            .font(.caption2)
                            .foregroundColor(themeManager.secondaryTextColor)
                    }
                    
                    Spacer()
                    
                    Button(action: {
                        
                    }) {
                        Image(systemName: "square.and.arrow.down")
                            .foregroundColor(themeManager.accentColor)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(themeManager.offsetColor)
                .cornerRadius(8)
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func cleanHtmlContent(_ html: String) -> String {
        return html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func iconForMimeType(_ mimeType: String) -> String {
        switch mimeType.lowercased() {
        case let type where type.contains("image"):
            return "photo"
        case let type where type.contains("pdf"):
            return "doc.text"
        case let type where type.contains("video"):
            return "video"
        case let type where type.contains("audio"):
            return "music.note"
        case let type where type.contains("zip") || type.contains("archive"):
            return "archivebox"
        default:
            return "doc"
        }
    }
    
    private func formatFileSize(_ size: Int) -> String {
        let sizeInMB = Double(size) / (1024 * 1024)
        if sizeInMB < 0.01 {
            return "\(size) bytes"
        } else {
            return String(format: "%.2f MB", sizeInMB)
        }
    }
}

struct ThreadDisplayView_Previews: PreviewProvider {
    static var previews: some View {
        let mockMessage = EmailMessage(
            id: "1",
            threadId: "thread1",
            subject: "Welcome to Zero Mail",
            body: "This is a sample email message to demonstrate the app functionality.",
            sender: EmailSender(name: "John Doe", email: "john@example.com"),
            to: [EmailSender(name: "You", email: "you@example.com")],
            cc: nil,
            bcc: nil,
            date: Date(),
            isRead: false,
            isStarred: false,
            isImportant: false,
            labels: [],
            attachments: nil
        )
        
        let mockThread = EmailThread(
            id: "thread1",
            messages: [mockMessage],
            subject: "Welcome to Zero Mail",
            participants: [EmailSender(name: "John Doe", email: "john@example.com")],
            lastMessageDate: Date(),
            isRead: false,
            isStarred: false,
            isImportant: false,
            messageCount: 1
        )
        
        ThreadDisplayView(thread: mockThread, mailService: MailService(authService: AuthService()))
            .environmentObject(ThemeManager())
    }
}
