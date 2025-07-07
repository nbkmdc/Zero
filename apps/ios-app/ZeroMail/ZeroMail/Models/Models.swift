import Foundation

struct User: Codable, Identifiable {
    let id: String
    let name: String
    let email: String
    let avatar: String?
}

struct EmailSender: Codable {
    let name: String?
    let email: String
}

struct EmailMessage: Codable, Identifiable {
    let id: String
    let threadId: String?
    let subject: String
    let body: String
    let sender: EmailSender
    let to: [EmailSender]
    let cc: [EmailSender]?
    let bcc: [EmailSender]?
    let date: Date
    let isRead: Bool
    let isStarred: Bool
    let isImportant: Bool
    let labels: [EmailLabel]
    let attachments: [EmailAttachment]?
    
    var displayName: String {
        sender.name?.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\"", with: "") ?? sender.email
    }
    
    var preview: String {
        let cleanBody = body.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        return String(cleanBody.prefix(100))
    }
}

struct EmailThread: Codable, Identifiable {
    let id: String
    let messages: [EmailMessage]
    let subject: String
    let participants: [EmailSender]
    let lastMessageDate: Date
    let isRead: Bool
    let isStarred: Bool
    let isImportant: Bool
    let messageCount: Int
    
    var latestMessage: EmailMessage? {
        messages.max(by: { $0.date < $1.date })
    }
}

struct EmailLabel: Codable, Identifiable {
    let id: String
    let name: String
    let color: String?
    let type: String
}

struct EmailAttachment: Codable, Identifiable {
    let id: String
    let filename: String
    let mimeType: String
    let size: Int
    let downloadUrl: String?
}

struct EmailFolder: Codable, Identifiable {
    let id: String
    let name: String
    let displayName: String
    let messageCount: Int
    let unreadCount: Int
    let icon: String?
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let success: Bool
    let user: User?
    let token: String?
    let error: String?
}

struct ThreadsResponse: Codable {
    let threads: [EmailThread]
    let hasMore: Bool
    let nextPageToken: String?
}

struct SearchRequest: Codable {
    let query: String
    let folder: String?
    let limit: Int?
    let pageToken: String?
}

enum AppTheme: String, CaseIterable {
    case light = "light"
    case dark = "dark"
    case system = "system"
    
    var displayName: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }
}
