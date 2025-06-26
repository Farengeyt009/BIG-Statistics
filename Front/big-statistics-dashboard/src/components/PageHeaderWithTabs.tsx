type Tab = {
    label: string;
    key: string;
};

type Props = {
    pageTitle: string;
    tabs: Tab[];
    activeTab: string;
    onTabChange?: (key: string) => void;
};

export default function PageHeaderWithTabs({ pageTitle, tabs, activeTab, onTabChange }: Props) {
    const handleTabClick = (key: string) => {
        onTabChange?.(key);
    };

    return (
        <div className="mb-4 border-b border-gray-300">
            {/* Заголовок */}
            <h1 className="text-2xl font-bold text-black mb-2">{pageTitle}</h1>

            {/* Вкладки */}
            <div className="flex items-center gap-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabClick(tab.key)}
                        className={`pb-2 border-b-2 transition-colors duration-150 ${
                            activeTab === tab.key
                                ? "border-blue-500 text-black font-semibold"
                                : "border-transparent text-black/50 hover:text-black"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
                <button
                    onClick={() => handleTabClick("custom")}
                    className={`pb-2 text-black/50 hover:text-black text-xl ${
                        activeTab === "custom"
                            ? "border-b-2 border-blue-500"
                            : "border-b-2 border-transparent"
                    }`}
                >
                    ＋
                </button>
            </div>
        </div>
    );
}
