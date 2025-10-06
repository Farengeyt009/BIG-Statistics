import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Settings } from 'lucide-react';
import Shipment from './Shipment/Shipment';
import ShipmentFilterModal from './Shipment/ShipmentFilterModal';

export default function Orders() {
    const [activeTab, setActiveTab] = useState("main");
    const { t } = useTranslation('ordersTranslation');
    const [isShipmentFilterOpen, setShipmentFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 29);
        return from;
    });
    const [endDate, setEndDate] = useState<Date | null>(() => new Date());
    const [reloadToken, setReloadToken] = useState<number>(0);
    const [previewRows, setPreviewRows] = useState<any[] | null>(null);

    return (
        <div className="p-4">
            <PageHeader
                title={t('title')}
                view={activeTab}
                onViewChange={setActiveTab}
                tabs={[{ key: 'main', label: t('mainTab') }, { key: 'shipment', label: t('shipmentTab') }]}
                rightSlot={activeTab === 'shipment' ? (
                    <div className="flex items-center gap-2">
                        <button
                            className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center"
                            title={t('ui.settings') as string}
                            aria-label={t('ui.settings') as string}
                            onClick={() => setShipmentFilterOpen(true)}
                        >
                            <Settings className="w-6 h-6" />
                        </button>
                    </div>
                ) : null}
            />
            {/* Простой экран-заглушка основного раздела */}
            {activeTab === 'main' && (
                <div className="flex items-center justify-center h-[420px] text-gray-500">
                    <div className="text-center">
                        <div className="text-2xl font-semibold mb-2">{t('title')}</div>
                        <div className="text-lg">Coming soon…</div>
                    </div>
                </div>
            )}
            {activeTab === 'shipment' && (
                <>
                    <Shipment
                        startDate={startDate}
                        endDate={endDate}
                        onChangeDates={(from, to) => { setStartDate(from); setEndDate(to); }}
                        reloadToken={reloadToken}
                        previewRows={previewRows}
                    />
                    <ShipmentFilterModal
                        isOpen={isShipmentFilterOpen}
                        onClose={() => setShipmentFilterOpen(false)}
                        startDate={startDate}
                        endDate={endDate}
                        onPublished={() => { setShipmentFilterOpen(false); setPreviewRows(null); setReloadToken(v => v + 1); }}
                        onApplyPreview={(rows) => { setPreviewRows(rows); }}
                    />
                </>
            )}
        </div>
    );
}


