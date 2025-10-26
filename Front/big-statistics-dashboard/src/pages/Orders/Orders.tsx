import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { Settings } from 'lucide-react';
import Shipment from './Shipment/Shipment';
import ShipmentFilterModal from './Shipment/ShipmentFilterModal';
import OrderData from './OrderData/OrderData';
import { usePageView } from '../../hooks/usePageView';
import { WarningModal } from '../../components/WarningModal/WarningModal';

export default function Orders() {
    const [activeTab, setActiveTab] = useState("orderdata");
    const { t } = useTranslation('ordersTranslation');
    
    // Логируем посещение страницы Orders
    usePageView('orders');
    const [isShipmentFilterOpen, setShipmentFilterOpen] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 29);
        return from;
    });
    const [endDate, setEndDate] = useState<Date | null>(() => new Date());
    const [reloadToken, setReloadToken] = useState<number>(0);
    const [previewRows, setPreviewRows] = useState<any[] | null>(null);

    // Показываем предупреждение при загрузке страницы
    useEffect(() => {
        setShowWarningModal(true);
    }, []);

    return (
        <div className="p-4">
            <PageHeader
                title={t('title')}
                view={activeTab}
                onViewChange={setActiveTab}
                tabs={[
                    { key: 'orderdata', label: t('orderDataTab') },
                    { key: 'shipment', label: t('shipmentTab') }
                ]}
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
            {activeTab === 'orderdata' && (
                <OrderData />
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
            
            {/* Модальное окно с предупреждением */}
            <WarningModal
                isOpen={showWarningModal}
                onClose={() => setShowWarningModal(false)}
            />
        </div>
    );
}


