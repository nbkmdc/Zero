import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var themeManager: ThemeManager
    
    var body: some View {
        Group {
            if authService.isAuthenticated {
                MailListView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: authService.isAuthenticated)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(ThemeManager())
            .environmentObject(AuthService())
    }
}
