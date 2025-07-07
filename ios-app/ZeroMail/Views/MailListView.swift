import SwiftUI

struct MailListView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var themeManager: ThemeManager
    @StateObject private var mailService: MailService
    
    @State private var selectedFolder = "inbox"
    @State private var searchText = ""
    @State private var showingSidebar = false
    @State private var selectedThread: EmailThread?
    
    init() {
        _mailService = StateObject(wrappedValue: MailService(authService: AuthService()))
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                themeManager.backgroundColor
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    headerView
                    
                    if mailService.isLoading && mailService.threads.isEmpty {
                        loadingView
                    } else if mailService.threads.isEmpty {
                        emptyStateView
                    } else {
                        threadListView
                    }
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showingSidebar) {
                SidebarView(
                    folders: mailService.folders,
                    selectedFolder: $selectedFolder,
                    themeManager: themeManager
                )
            }
            .sheet(item: $selectedThread) { thread in
                ThreadDisplayView(thread: thread, mailService: mailService)
                    .environmentObject(themeManager)
            }
        }
        .onAppear {
            mailService.authService = authService
            Task {
                await mailService.loadThreads(folder: selectedFolder)
            }
        }
        .onChange(of: selectedFolder) { folder in
            Task {
                await mailService.loadThreads(folder: folder, searchQuery: searchText.isEmpty ? nil : searchText)
            }
        }
        .onChange(of: searchText) { query in
            if !query.isEmpty {
                Task {
                    await mailService.loadThreads(folder: selectedFolder, searchQuery: query)
                }
            }
        }
    }
    
    private var headerView: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    showingSidebar = true
                }) {
                    Image(systemName: "line.horizontal.3")
                        .foregroundColor(themeManager.iconColor)
                        .font(.title2)
                }
                
                Spacer()
                
                Text(selectedFolder.capitalized)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(themeManager.primaryTextColor)
                
                Spacer()
                
                Button(action: {
                    authService.logout()
                }) {
                    Image(systemName: "person.circle")
                        .foregroundColor(themeManager.iconColor)
                        .font(.title2)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(themeManager.panelColor)
            
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(themeManager.iconColor)
                
                TextField("Search emails...", text: $searchText)
                    .foregroundColor(themeManager.primaryTextColor)
                
                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(themeManager.iconColor)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(themeManager.offsetColor)
            .cornerRadius(8)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(themeManager.panelColor)
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: themeManager.accentColor))
                .scaleEffect(1.2)
            
            Text("Loading emails...")
                .foregroundColor(themeManager.secondaryTextColor)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(themeManager.iconColor)
            
            Text("No emails found")
                .font(.headline)
                .foregroundColor(themeManager.primaryTextColor)
            
            Text("Your \(selectedFolder) is empty")
                .font(.subheadline)
                .foregroundColor(themeManager.secondaryTextColor)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var threadListView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(mailService.threads) { thread in
                    ThreadRowView(
                        thread: thread,
                        themeManager: themeManager,
                        onTap: {
                            selectedThread = thread
                            Task {
                                await mailService.markAsRead(threadId: thread.id)
                            }
                        },
                        onStar: {
                            Task {
                                await mailService.toggleStar(threadId: thread.id)
                            }
                        }
                    )
                    .background(themeManager.panelColor)
                    
                    Divider()
                        .background(themeManager.offsetColor)
                }
            }
        }
        .refreshable {
            await mailService.loadThreads(folder: selectedFolder, searchQuery: searchText.isEmpty ? nil : searchText)
        }
    }
}

struct ThreadRowView: View {
    let thread: EmailThread
    let themeManager: ThemeManager
    let onTap: () -> Void
    let onStar: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(thread.latestMessage?.displayName ?? "Unknown")
                            .font(.subheadline)
                            .fontWeight(thread.isRead ? .regular : .semibold)
                            .foregroundColor(themeManager.primaryTextColor)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        Text(formatDate(thread.lastMessageDate))
                            .font(.caption)
                            .foregroundColor(themeManager.secondaryTextColor)
                    }
                    
                    Text(thread.subject)
                        .font(.subheadline)
                        .fontWeight(thread.isRead ? .regular : .medium)
                        .foregroundColor(themeManager.primaryTextColor)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Text(thread.latestMessage?.preview ?? "")
                        .font(.caption)
                        .foregroundColor(themeManager.secondaryTextColor)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                VStack(spacing: 8) {
                    Button(action: onStar) {
                        Image(systemName: thread.isStarred ? "star.fill" : "star")
                            .foregroundColor(thread.isStarred ? .yellow : themeManager.iconColor)
                            .font(.subheadline)
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    if !thread.isRead {
                        Circle()
                            .fill(themeManager.accentColor)
                            .frame(width: 8, height: 8)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        
        if calendar.isToday(date) {
            formatter.timeStyle = .short
            return formatter.string(from: date)
        } else if calendar.isDate(date, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        } else {
            formatter.dateFormat = "MMM d, yyyy"
            return formatter.string(from: date)
        }
    }
}

struct SidebarView: View {
    let folders: [EmailFolder]
    @Binding var selectedFolder: String
    let themeManager: ThemeManager
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                List {
                    ForEach(folders) { folder in
                        Button(action: {
                            selectedFolder = folder.name
                            presentationMode.wrappedValue.dismiss()
                        }) {
                            HStack {
                                Image(systemName: folder.icon ?? "folder")
                                    .foregroundColor(themeManager.iconColor)
                                    .frame(width: 20)
                                
                                Text(folder.displayName)
                                    .foregroundColor(themeManager.primaryTextColor)
                                
                                Spacer()
                                
                                if folder.unreadCount > 0 {
                                    Text("\(folder.unreadCount)")
                                        .font(.caption)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(themeManager.accentColor)
                                        .cornerRadius(10)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(PlainButtonStyle())
                        .listRowBackground(selectedFolder == folder.name ? themeManager.offsetColor : themeManager.panelColor)
                    }
                }
                .listStyle(PlainListStyle())
                .background(themeManager.panelColor)
            }
            .background(themeManager.backgroundColor)
            .navigationTitle("Folders")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("Done") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
}

struct MailListView_Previews: PreviewProvider {
    static var previews: some View {
        MailListView()
            .environmentObject(ThemeManager())
            .environmentObject(AuthService())
    }
}
