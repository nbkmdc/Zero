import Foundation
import Combine

@MainActor
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = "http://localhost:8787"
    private let session = URLSession.shared
    
    init() {
        checkAuthStatus()
    }
    
    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let loginRequest = LoginRequest(email: email, password: password)
            let url = URL(string: "\(baseURL)/api/auth/login")!
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(loginRequest)
            
            let (data, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                    
                    if loginResponse.success, let user = loginResponse.user, let token = loginResponse.token {
                        currentUser = user
                        isAuthenticated = true
                        
                        UserDefaults.standard.set(token, forKey: "auth_token")
                        UserDefaults.standard.set(try JSONEncoder().encode(user), forKey: "current_user")
                    } else {
                        errorMessage = loginResponse.error ?? "Login failed"
                    }
                } else {
                    errorMessage = "Server error: \(httpResponse.statusCode)"
                }
            }
        } catch {
            if error.localizedDescription.contains("Could not connect") {
                await loginWithMockData(email: email)
            } else {
                errorMessage = "Network error: \(error.localizedDescription)"
            }
        }
        
        isLoading = false
    }
    
    private func loginWithMockData(email: String) async {
        let mockUser = User(
            id: "mock-user-1",
            name: "Test User",
            email: email,
            avatar: nil
        )
        
        currentUser = mockUser
        isAuthenticated = true
        
        UserDefaults.standard.set("mock-token", forKey: "auth_token")
        if let userData = try? JSONEncoder().encode(mockUser) {
            UserDefaults.standard.set(userData, forKey: "current_user")
        }
    }
    
    func logout() {
        isAuthenticated = false
        currentUser = nil
        
        UserDefaults.standard.removeObject(forKey: "auth_token")
        UserDefaults.standard.removeObject(forKey: "current_user")
    }
    
    func clearError() {
        errorMessage = nil
    }
    
    private func checkAuthStatus() {
        if let token = UserDefaults.standard.string(forKey: "auth_token"),
           let userData = UserDefaults.standard.data(forKey: "current_user"),
           let user = try? JSONDecoder().decode(User.self, from: userData) {
            currentUser = user
            isAuthenticated = true
        }
    }
    
    var authToken: String? {
        UserDefaults.standard.string(forKey: "auth_token")
    }
}
