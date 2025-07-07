import Foundation

class MailService: ObservableObject {
    @Published var threads: [EmailThread] = []
    @Published var currentThread: EmailThread?
    @Published var folders: [EmailFolder] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = "http://localhost:8787"
    private let authService: AuthService
    
    init(authService: AuthService) {
        self.authService = authService
        loadDefaultFolders()
    }
    
    private func loadDefaultFolders() {
        folders = [
            EmailFolder(id: "inbox", name: "inbox", displayName: "Inbox", messageCount: 0, unreadCount: 0, icon: "tray"),
            EmailFolder(id: "sent", name: "sent", displayName: "Sent", messageCount: 0, unreadCount: 0, icon: "paperplane"),
            EmailFolder(id: "drafts", name: "drafts", displayName: "Drafts", messageCount: 0, unreadCount: 0, icon: "doc.text"),
            EmailFolder(id: "spam", name: "spam", displayName: "Spam", messageCount: 0, unreadCount: 0, icon: "exclamationmark.triangle"),
            EmailFolder(id: "trash", name: "trash", displayName: "Trash", messageCount: 0, unreadCount: 0, icon: "trash"),
            EmailFolder(id: "archive", name: "archive", displayName: "Archive", messageCount: 0, unreadCount: 0, icon: "archivebox")
        ]
    }
    
    func loadThreads(folder: String = "inbox", searchQuery: String? = nil) async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        do {
            var urlComponents = URLComponents(string: "\(baseURL)/api/mail/threads")!
            urlComponents.queryItems = [
                URLQueryItem(name: "folder", value: folder),
                URLQueryItem(name: "limit", value: "50")
            ]
            
            if let query = searchQuery, !query.isEmpty {
                urlComponents.queryItems?.append(URLQueryItem(name: "q", value: query))
            }
            
            guard let url = urlComponents.url else {
                throw URLError(.badURL)
            }
            
            var request = URLRequest(url: url)
            request.setValue("Bearer \(authService.authToken)", forHTTPHeaderField: "Authorization")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }
            
            if httpResponse.statusCode == 200 {
                let threadsResponse = try JSONDecoder().decode(ThreadsResponse.self, from: data)
                
                await MainActor.run {
                    self.threads = threadsResponse.threads
                    self.isLoading = false
                }
            } else {
                await MainActor.run {
                    self.errorMessage = "Failed to load emails"
                    self.isLoading = false
                }
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Network error: \(error.localizedDescription)"
                self.isLoading = false
                
                self.loadMockData()
            }
        }
    }
    
    func loadThread(threadId: String) async {
        do {
            guard let url = URL(string: "\(baseURL)/api/mail/thread/\(threadId)") else {
                throw URLError(.badURL)
            }
            
            var request = URLRequest(url: url)
            request.setValue("Bearer \(authService.authToken)", forHTTPHeaderField: "Authorization")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }
            
            if httpResponse.statusCode == 200 {
                let thread = try JSONDecoder().decode(EmailThread.self, from: data)
                
                await MainActor.run {
                    self.currentThread = thread
                }
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Failed to load thread: \(error.localizedDescription)"
            }
        }
    }
    
    func markAsRead(threadId: String) async {
        guard let url = URL(string: "\(baseURL)/api/mail/thread/\(threadId)/read") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(authService.authToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let _ = try await URLSession.shared.data(for: request)
            
            await MainActor.run {
                if let index = threads.firstIndex(where: { $0.id == threadId }) {
                    var updatedThread = threads[index]
                    updatedThread = EmailThread(
                        id: updatedThread.id,
                        messages: updatedThread.messages,
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
        } catch {
            print("Failed to mark as read: \(error)")
        }
    }
    
    func toggleStar(threadId: String) async {
        guard let url = URL(string: "\(baseURL)/api/mail/thread/\(threadId)/star") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(authService.authToken)", forHTTPHeaderField: "Authorization")
        
        do {
            let _ = try await URLSession.shared.data(for: request)
            
            await MainActor.run {
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
        } catch {
            print("Failed to toggle star: \(error)")
        }
    }
    
    private func loadMockData() {
        let mockSender = EmailSender(name: "John Doe", email: "john@example.com")
        let mockMessage = EmailMessage(
            id: "1",
            threadId: "thread1",
            subject: "Welcome to Zero Mail",
            body: "This is a sample email message to demonstrate the app functionality.",
            sender: mockSender,
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
            participants: [mockSender],
            lastMessageDate: Date(),
            isRead: false,
            isStarred: false,
            isImportant: false,
            messageCount: 1
        )
        
        threads = [mockThread]
    }
}
