import SwiftUI

class ThemeManager: ObservableObject {
    @Published var currentTheme: AppTheme = .system
    @AppStorage("app_theme") private var storedTheme: String = AppTheme.system.rawValue
    
    var colorScheme: ColorScheme? {
        switch currentTheme {
        case .light:
            return .light
        case .dark:
            return .dark
        case .system:
            return nil
        }
    }
    
    init() {
        if let theme = AppTheme(rawValue: storedTheme) {
            currentTheme = theme
        }
    }
    
    func setTheme(_ theme: AppTheme) {
        currentTheme = theme
        storedTheme = theme.rawValue
    }
    
    var backgroundColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color(red: 1.0, green: 1.0, blue: 1.0)
        case .dark:
            return Color(red: 0.08, green: 0.08, blue: 0.08)
        }
    }
    
    var offsetColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color(red: 0.96, green: 0.96, blue: 0.96)
        case .dark:
            return Color(red: 0.04, green: 0.04, blue: 0.04)
        }
    }
    
    var panelColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color.white
        case .dark:
            return Color(red: 0.10, green: 0.10, blue: 0.10)
        }
    }
    
    var iconColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color(red: 0.43, green: 0.43, blue: 0.43)
        case .dark:
            return Color(red: 0.54, green: 0.54, blue: 0.54)
        }
    }
    
    var primaryTextColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color.black
        case .dark:
            return Color.white
        }
    }
    
    var secondaryTextColor: Color {
        switch currentTheme {
        case .light, .system:
            return Color(red: 0.43, green: 0.43, blue: 0.43)
        case .dark:
            return Color(red: 0.70, green: 0.70, blue: 0.70)
        }
    }
    
    var accentColor: Color {
        return Color(red: 0.26, green: 0.49, blue: 0.98)
    }
}
