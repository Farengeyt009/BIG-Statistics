import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout } from '../../components/Layout';
import { Settings } from 'lucide-react';
import Shipment from './Shipment/Shipment';
import ShipmentFilterModal from './Shipment/ShipmentFilterModal';
import OrderData from './OrderData/OrderData';
import SalePlan from './SalePlan/SalePlan';
import { usePageView } from '../../hooks/usePageView';
import { WarningModal } from '../../components/WarningModal/WarningModal';

export default function Orders() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabFromUrl || "orderdata");
    
    // Обновляем активную вкладку при изменении параметра в URL
    useEffect(() => {
        if (tabFromUrl && ['orderdata', 'shipment', 'saleplan'].includes(tabFromUrl)) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);
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

    // Предупреждение убрано с Orders (переместили на KPI и Task Manager)

    return (
        <PageLayout>
            <PageHeader
                title={t('title')}
                view={activeTab}
                onViewChange={setActiveTab}
                tabs={[
                    { key: 'orderdata', label: t('orderDataTab') },
                    { key: 'shipment', label: t('shipmentTab') },
                    { key: 'saleplan', label: 'Sale Plan' }
                ]}
                rightSlot={null}
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
                        onOpenFilterModal={() => setShipmentFilterOpen(true)}
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

            {activeTab === 'saleplan' && (
                <SalePlan
                    startDate={startDate}
                    endDate={endDate}
                    onChangeDates={(from, to) => { setStartDate(from); setEndDate(to); }}
                />
            )}
            
            {/* Модальное окно с предупреждением убрано */}
        </PageLayout>
    );
}


