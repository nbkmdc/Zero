import Foundation
import Combine

@MainActor
class MailService: ObservableObject {
    @Published var threads: [EmailThread] = []
    @Published var folders: [EmailFolder] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    var authService: AuthService?
    private let baseURL = "http://localhost:8787"
    private let session = URLSession.shared
    
    init(authService: AuthService? = nil) {
        self.authService = authService
        loadFolders()
    }
    
    func loadThreads(folder: String, searchQuery: String? = nil) async {
        isLoading = true
        errorMessage = nil
        
        do {
            var urlComponents = URLComponents(string: "\(baseURL)/api/mail/threads")!
            var queryItems = [URLQueryItem(name: "folder", value: folder)]
            
            if let searchQuery = searchQuery, !searchQuery.isEmpty {
                queryItems.append(URLQueryItem(name: "q", value: searchQuery))
            }
            
            urlComponents.queryItems = queryItems
            
            var request = URLRequest(url: urlComponents.url!)
            request.httpMethod = "GET"
            
            if let token = authService?.authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let (data, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                
                let threadsResponse = try decoder.decode(ThreadsResponse.self, from: data)
                threads = threadsResponse.threads
            } else {
                throw URLError(.badServerResponse)
            }
        } catch {
            await loadMockThreads(folder: folder, searchQuery: searchQuery)
        }
        
        isLoading = false
    }
    
    private func loadMockThreads(folder: String, searchQuery: String? = nil) async {
        let mockSender = EmailSender(name: "John Doe", email: "john@example.com")
        let mockSender2 = EmailSender(name: "Jane Smith", email: "jane@example.com")
        
        let mockMessage1 = EmailMessage(
            id: "msg-1",
            threadId: "thread-1",
            subject: "Welcome to Zero Mail",
            body: "This is a welcome message to Zero Mail. We're excited to have you on board!",
            sender: mockSender,
            to: [EmailSender(name: "You", email: "you@zero.email")],
            cc: nil,
            bcc: nil,
            date: Date().addingTimeInterval(-3600),
            isRead: false,
            isStarred: true,
            isImportant: false,
            labels: [],
            attachments: nil
        )
        
        let mockMessage2 = EmailMessage(
            id: "msg-2",
            threadId: "thread-2",
            subject: "Project Update",
            body: "Here's the latest update on our project. Everything is going according to plan.",
            sender: mockSender2,
            to: [EmailSender(name: "You", email: "you@zero.email")],
            cc: nil,
            bcc: nil,
            date: Date().addingTimeInterval(-7200),
            isRead: true,
            isStarred: false,
            isImportant: true,
            labels: [],
            attachments: nil
        )
        
        let mockThread1 = EmailThread(
            id: "thread-1",
            messages: [mockMessage1],
            subject: "Welcome to Zero Mail",
            participants: [mockSender],
            lastMessageDate: mockMessage1.date,
            isRead: false,
            isStarred: true,
            isImportant: false,
            messageCount: 1
        )
        
        let mockThread2 = EmailThread(
            id: "thread-2",
            messages: [mockMessage2],
            subject: "Project Update",
            participants: [mockSender2],
            lastMessageDate: mockMessage2.date,
            isRead: true,
            isStarred: false,
            isImportant: true,
            messageCount: 1
        )
        
        var mockThreads = [mockThread1, mockThread2]
        
        if let searchQuery = searchQuery, !searchQuery.isEmpty {
            mockThreads = mockThreads.filter { thread in
                thread.subject.localizedCaseInsensitiveContains(searchQuery) ||
                thread.messages.contains { message in
                    message.body.localizedCaseInsensitiveContains(searchQuery) ||
                    message.sender.name?.localizedCaseInsensitiveContains(searchQuery) == true
                }
            }
        }
        
        threads = mockThreads
    }
    
    private func loadFolders() {
        folders = [
            EmailFolder(id: "inbox", name: "inbox", displayName: "Inbox", messageCount: 25, unreadCount: 3, icon: "tray"),
            EmailFolder(id: "sent", name: "sent", displayName: "Sent", messageCount: 12, unreadCount: 0, icon: "paperplane"),
            EmailFolder(id: "drafts", name: "drafts", displayName: "Drafts", messageCount: 2, unreadCount: 0, icon: "doc.text"),
            EmailFolder(id: "spam", name: "spam", displayName: "Spam", messageCount: 8, unreadCount: 1, icon: "exclamationmark.triangle"),
            EmailFolder(id: "trash", name: "trash", displayName: "Trash", messageCount: 15, unreadCount: 0, icon: "trash"),
            EmailFolder(id: "archive", name: "archive", displayName: "Archive", messageCount: 156, unreadCount: 0, icon: "archivebox")
        ]
    }
    
    func markAsRead(threadId: String) async {
        if let index = threads.firstIndex(where: { $0.id == threadId }) {
            var updatedThread = threads[index]
            updatedThread = EmailThread(
                id: updatedThread.id,
                messages: updatedThread.messages.map { message in
                    EmailMessage(
                        id: message.id,
                        threadId: message.threadId,
                        subject: message.subject,
                        body: message.body,
                        sender: message.sender,
                        to: message.to,
                        cc: message.cc,
                        bcc: message.bcc,
                        date: message.date,
                        isRead: true,
                        isStarred: message.isStarred,
                        isImportant: message.isImportant,
                        labels: message.labels,
                        attachments: message.attachments
                    )
                },
                subject: updatedThread.subject,
                participants: updatedThread.participants,
                lastMessageDate: updatedThread.lastMessageDate,
                isRead: true,
                isStarred: updatedThread.isStarred,
                isImportant: updatedThread.isImportant,
                messageCount: updatedThread.messageCount
            )
            threads[index] = updatedThread
        }
    }
    
    func toggleStar(threadId: String) async {
        if let index = threads.firstIndex(where: { $0.id == threadId }) {
            var updatedThread = threads[index]
            updatedThread = EmailThread(
                id: updatedThread.id,
                messages: updatedThread.messages,
                subject: updatedThread.subject,
                participants: updatedThread.participants,
                lastMessageDate: updatedThread.lastMessageDate,
                isRead: updatedThread.isRead,
                isStarred: !updatedThread.isStarred,
                isImportant: updatedThread.isImportant,
                messageCount: updatedThread.messageCount
            )
            threads[index] = updatedThread
        }
    }
}
