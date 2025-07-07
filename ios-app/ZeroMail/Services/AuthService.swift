import Foundation
import SwiftUI

class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let baseURL = "http://localhost:8787"
    
    @AppStorage("auth_token") private var authToken: String = ""
    @AppStorage("user_data") private var userData: Data = Data()
    
    init() {
        loadStoredAuth()
    }
    
    private func loadStoredAuth() {
        if !authToken.isEmpty {
            if let user = try? JSONDecoder().decode(User.self, from: userData) {
                currentUser = user
                isAuthenticated = true
            }
        }
    }
    
    func login(email: String, password: String) async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        do {
            let loginRequest = LoginRequest(email: email, password: password)
            let requestData = try JSONEncoder().encode(loginRequest)
            
            guard let url = URL(string: "\(baseURL)/api/auth/login") else {
                throw URLError(.badURL)
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = requestData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }
            
            if httpResponse.statusCode == 200 {
                let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                
                if loginResponse.success, let user = loginResponse.user, let token = loginResponse.token {
                    await MainActor.run {
                        self.currentUser = user
                        self.authToken = token
                        self.userData = (try? JSONEncoder().encode(user)) ?? Data()
                        self.isAuthenticated = true
                        self.isLoading = false
                    }
                } else {
                    await MainActor.run {
                        self.errorMessage = loginResponse.error ?? "Login failed"
                        self.isLoading = false
                    }
                }
            } else {
                await MainActor.run {
                    self.errorMessage = "Invalid credentials"
                    self.isLoading = false
                }
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Network error: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }
    
    func logout() {
        authToken = ""
        userData = Data()
        currentUser = nil
        isAuthenticated = false
        errorMessage = nil
    }
    
    func clearError() {
        errorMessage = nil
    }
}
