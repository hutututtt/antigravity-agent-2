import React from 'react';

interface AppLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ sidebar, children }) => {
    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Fixed Sidebar */}
            <aside className="flex-shrink-0 w-64">
                {sidebar}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 overflow-auto">
                <div className="max-w-7xl mx-auto p-8 animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
};
