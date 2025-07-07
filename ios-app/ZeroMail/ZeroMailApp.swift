import SwiftUI

@main
struct ZeroMailApp: App {
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var authService = AuthService()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .environmentObject(authService)
                .preferredColorScheme(themeManager.colorScheme)
        }
    }
}
