import SwiftUI
import Combine

class ThemeManager: ObservableObject {
    @Published var currentTheme: AppTheme = .system
    @Published var colorScheme: ColorScheme? = nil
    
    init() {
        updateColorScheme()
    }
    
    func setTheme(_ theme: AppTheme) {
        currentTheme = theme
        updateColorScheme()
    }
    
    private func updateColorScheme() {
        switch currentTheme {
        case .light:
            colorScheme = .light
        case .dark:
            colorScheme = .dark
        case .system:
            colorScheme = nil
        }
    }
    
    var backgroundColor: Color {
        Color(UIColor.systemBackground)
    }
    
    var panelColor: Color {
        Color(UIColor.secondarySystemBackground)
    }
    
    var offsetColor: Color {
        Color(UIColor.tertiarySystemBackground)
    }
    
    var primaryTextColor: Color {
        Color(UIColor.label)
    }
    
    var secondaryTextColor: Color {
        Color(UIColor.secondaryLabel)
    }
    
    var iconColor: Color {
        Color(UIColor.systemGray)
    }
    
    var accentColor: Color {
        Color.blue
    }
    
    var borderColor: Color {
        Color(UIColor.separator)
    }
}
