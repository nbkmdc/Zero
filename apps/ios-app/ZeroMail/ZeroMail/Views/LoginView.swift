import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var themeManager: ThemeManager
    
    @State private var email = ""
    @State private var password = ""
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
                            
                            Text("Enter your Zero email below to login to your account")
                                .font(.body)
                                .foregroundColor(themeManager.secondaryTextColor)
                                .multilineTextAlignment(.center)
                        }
                        
                        VStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Email")
                                    .font(.subheadline)
                                    .foregroundColor(themeManager.secondaryTextColor)
                                
                                TextField("nizzy@0.email", text: $email)
                                    .textFieldStyle(ZeroTextFieldStyle(themeManager: themeManager))
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .disableAutocorrection(true)
                            }
                            
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text("Password")
                                        .font(.subheadline)
                                        .foregroundColor(themeManager.secondaryTextColor)
                                    
                                    Spacer()
                                    
                                    Button("Forgot your password?") {
                                        
                                    }
                                    .font(.caption)
                                    .foregroundColor(themeManager.secondaryTextColor)
                                }
                                
                                SecureField("••••••••", text: $password)
                                    .textFieldStyle(ZeroTextFieldStyle(themeManager: themeManager))
                            }
                            
                            Button(action: {
                                Task {
                                    await authService.login(email: email, password: password)
                                }
                            }) {
                                HStack {
                                    if authService.isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                            .scaleEffect(0.8)
                                    } else {
                                        Text("Login")
                                            .fontWeight(.medium)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(themeManager.accentColor)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                            .disabled(authService.isLoading || email.isEmpty || password.isEmpty)
                            
                            HStack {
                                Text("Don't have an account?")
                                    .font(.subheadline)
                                    .foregroundColor(themeManager.secondaryTextColor)
                                
                                Button("Sign up") {
                                    
                                }
                                .font(.subheadline)
                                .foregroundColor(themeManager.primaryTextColor)
                                .underline()
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
