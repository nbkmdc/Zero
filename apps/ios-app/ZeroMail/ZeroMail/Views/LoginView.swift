import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var themeManager: ThemeManager
    
    @State private var showingAlert = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                themeManager.backgroundColor
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    Spacer()
                    
                    VStack(spacing: 24) {
                        VStack(spacing: 8) {
                            Text("Login with Zero")
                                .font(.largeTitle)
                                .fontWeight(.bold)
                                .foregroundColor(themeManager.primaryTextColor)
                            
                            Text("Sign in with your Google account to access Zero Mail")
                                .font(.body)
                                .foregroundColor(themeManager.secondaryTextColor)
                                .multilineTextAlignment(.center)
                        }
                        
                        VStack(spacing: 16) {
                            Button(action: {
                                Task {
                                    await authService.loginWithGoogle()
                                }
                            }) {
                                HStack(spacing: 12) {
                                    if authService.isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                            .scaleEffect(0.8)
                                    } else {
                                        Image(systemName: "globe")
                                            .font(.title2)
                                        Text("Continue with Google")
                                            .fontWeight(.medium)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(themeManager.accentColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                            .disabled(authService.isLoading)
                            
                            if authService.isAuthenticated, let user = authService.currentUser {
                                VStack(spacing: 8) {
                                    Text("Welcome, \(user.name)!")
                                        .font(.headline)
                                        .foregroundColor(themeManager.primaryTextColor)
                                    
                                    Text(user.email)
                                        .font(.subheadline)
                                        .foregroundColor(themeManager.secondaryTextColor)
                                    
                                    if let avatar = user.avatar {
                                        AsyncImage(url: URL(string: avatar)) { image in
                                            image
                                                .resizable()
                                                .aspectRatio(contentMode: .fill)
                                        } placeholder: {
                                            Circle()
                                                .fill(themeManager.offsetColor)
                                        }
                                        .frame(width: 60, height: 60)
                                        .clipShape(Circle())
                                    }
                                }
                                .padding()
                                .background(themeManager.panelColor)
                                .cornerRadius(12)
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .frame(maxWidth: 400)
                    
                    Spacer()
                    
                    HStack(spacing: 24) {
                        Button("Terms of Service") {
                            
                        }
                        .font(.caption2)
                        .foregroundColor(themeManager.iconColor)
                        
                        Button("Privacy Policy") {
                            
                        }
                        .font(.caption2)
                        .foregroundColor(themeManager.iconColor)
                    }
                    .padding(.bottom, 20)
                }
            }
        }
        .alert("Login Error", isPresented: $showingAlert) {
            Button("OK") {
                authService.clearError()
            }
        } message: {
            Text(authService.errorMessage ?? "Unknown error occurred")
        }
        .onChange(of: authService.errorMessage) { errorMessage in
            showingAlert = errorMessage != nil
        }
    }
}

struct ZeroTextFieldStyle: TextFieldStyle {
    let themeManager: ThemeManager
    
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(themeManager.backgroundColor)
            .foregroundColor(themeManager.primaryTextColor)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(themeManager.iconColor.opacity(0.3), lineWidth: 1)
            )
    }
}

struct LoginView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            LoginView()
                .environmentObject(ThemeManager())
                .environmentObject(AuthService())
                .preferredColorScheme(.light)
            
            LoginView()
                .environmentObject(ThemeManager())
                .environmentObject(AuthService())
                .preferredColorScheme(.dark)
        }
    }
}
