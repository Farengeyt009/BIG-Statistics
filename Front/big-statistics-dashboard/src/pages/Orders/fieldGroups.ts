export const FIELD_GROUPS: Record<string, string[]> = {
    'Информация о заказе': [
        'ShipmentYear',
        'ShipmentMonth',
        'OrderDate',
        'OrderConformDay',
        'RunOrderDay',
        'OrderShipmentDay_Svod',
        'Order_No',
        'Market',
        'Delay',
        'ProductionOrder',
    ],
    'Информация о продукте': [
        'Prod_Group',
        'GroupName',
        'Article_number',
        'Name_CN',
        'Power',
        'HeadAndOther',
        'Firmware',
        'Displacement',
    ],
    'Кол-во': [
        'Total_Order_QTY',
        'Order_QTY',
        'FACT_QTY',
        'Uncompleted_QTY',
    ],
}; 